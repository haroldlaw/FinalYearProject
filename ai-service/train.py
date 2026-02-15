import torch
import torch.nn as nn
import torch.optim as optim
from torch.optim.lr_scheduler import ReduceLROnPlateau, CosineAnnealingLR
import numpy as np
import matplotlib.pyplot as plt
from tqdm import tqdm
import time
import json
import os
from pathlib import Path
import argparse
from datetime import datetime

from dataset import create_data_loaders
from model import create_model, AestheticLoss

class ModelTrainer:
    """
    Complete training pipeline for photography evaluation model.
    """

    def __init__(self, config):
        """
        Initialize trainer with configuration.

        Args:
            config (dict): Training configuration
        """
        self.config = config
        if torch.backends.mps.is_available():
            self.device = torch.device('mps')
            print("Using Apple Metal Performance Shaders (MPS) for GPU acceleration")
        elif torch.cuda.is_available():
            self.device = torch.device('cuda')
            print("Using NVIDIA CUDA for GPU acceleration")
        else:
            self.device = torch.device('cpu')
            print("Using CPU")
        self.best_val_loss = float('inf')
        self.train_losses = []
        self.val_losses = []
        self.learning_rates = []

        # Create output directory
        self.output_dir = Path(config['output_dir'])
        self.output_dir.mkdir(parents=True, exist_ok=True)

        print(f"Trainer initialized:")
        print(f"  Device: {self.device}")
        print(f"  Output directory: {self.output_dir}")

    def setup_data_loaders(self):
        """Setup train/validation/test data loaders."""
        print("Setting up data loaders...")

        self.train_loader, self.val_loader, self.test_loader, self.split_info = create_data_loaders(
            csv_path=self.config['csv_path'],
            images_path=self.config['images_path'],
            batch_size=self.config['batch_size'],
            val_split=self.config['val_split'],
            test_split=self.config['test_split'],
            num_workers=self.config['num_workers'],
            random_state=self.config['random_seed']
        )

        # Save split info
        with open(self.output_dir / 'split_info.json', 'w') as f:
            json.dump(self.split_info, f, indent=2, default=str)

        print("Data loaders setup complete!")

    def setup_model(self):
        """Setup model, loss function, and optimizer."""
        print("Setting up model...")

        # Create model
        self.model, self.criterion, self.model_info = create_model(
            backbone=self.config['backbone'],
            pretrained=self.config['pretrained'],
            device=self.device
        )

        # Setup optimizer
        if self.config['optimizer'] == 'adam':
            self.optimizer = optim.Adam(
                self.model.parameters(),
                lr=self.config['learning_rate'],
                weight_decay=self.config['weight_decay']
            )
        elif self.config['optimizer'] == 'sgd':
            self.optimizer = optim.SGD(
                self.model.parameters(),
                lr=self.config['learning_rate'],
                momentum=0.9,
                weight_decay=self.config['weight_decay']
            )
        else:
            raise ValueError(
                f"Unsupported optimizer: {self.config['optimizer']}")

        # Setup scheduler
        if self.config['scheduler'] == 'reduce_on_plateau':
            self.scheduler = ReduceLROnPlateau(
                self.optimizer, mode='min', factor=0.5, patience=5
            )
        elif self.config['scheduler'] == 'cosine':
            self.scheduler = CosineAnnealingLR(
                self.optimizer, T_max=self.config['epochs']
            )
        else:
            self.scheduler = None

        # Save model info
        with open(self.output_dir / 'model_info.json', 'w') as f:
            json.dump(self.model_info, f, indent=2)

        print("Model setup complete!")

    def train_epoch(self, epoch):
        """Train for one epoch."""
        self.model.train()
        total_loss = 0.0
        total_mse = 0.0
        total_ranking = 0.0
        num_batches = len(self.train_loader)

        pbar = tqdm(
            self.train_loader,
            desc=f'Epoch {epoch+1}/{self.config["epochs"]} [Train]')

        for batch_idx, (images, targets, metadata) in enumerate(pbar):
            # Move to device
            images = images.to(self.device, non_blocking=True)
            targets = targets.to(self.device, non_blocking=True)

            # Forward pass
            self.optimizer.zero_grad()
            predictions = self.model(images)

            # Calculate loss
            loss, mse_loss, ranking_loss = self.criterion(
                predictions.squeeze(), targets)

            # Backward pass
            loss.backward()

            # Gradient clipping
            if self.config.get('gradient_clip', 0) > 0:
                torch.nn.utils.clip_grad_norm_(
                    self.model.parameters(), self.config['gradient_clip']
                )

            self.optimizer.step()

            # Update metrics
            total_loss += loss.item()
            total_mse += mse_loss.item()
            total_ranking += ranking_loss

            # Update progress bar
            avg_loss = total_loss / (batch_idx + 1)
            pbar.set_postfix({
                'Loss': f'{avg_loss:.4f}',
                'MSE': f'{total_mse / (batch_idx + 1):.4f}',
                'LR': f'{self.optimizer.param_groups[0]["lr"]:.6f}'
            })

        # Calculate epoch averages
        avg_loss = total_loss / num_batches
        avg_mse = total_mse / num_batches
        avg_ranking = total_ranking / num_batches

        return avg_loss, avg_mse, avg_ranking

    def validate_epoch(self, epoch):
        """Validate for one epoch."""
        self.model.eval()
        total_loss = 0.0
        total_mse = 0.0
        total_ranking = 0.0
        all_predictions = []
        all_targets = []

        with torch.no_grad():
            pbar = tqdm(
                self.val_loader,
                desc=f'Epoch {epoch+1}/{self.config["epochs"]} [Val]')

            for batch_idx, (images, targets, metadata) in enumerate(pbar):
                # Move to device
                images = images.to(self.device, non_blocking=True)
                targets = targets.to(self.device, non_blocking=True)

                # Forward pass
                predictions = self.model(images)

                # Calculate loss
                loss, mse_loss, ranking_loss = self.criterion(
                    predictions.squeeze(), targets)

                # Update metrics
                total_loss += loss.item()
                total_mse += mse_loss.item()
                total_ranking += ranking_loss

                # Store predictions for analysis
                all_predictions.extend(predictions.squeeze().cpu().numpy())
                all_targets.extend(targets.cpu().numpy())

                # Update progress bar
                avg_loss = total_loss / (batch_idx + 1)
                pbar.set_postfix({
                    'Loss': f'{avg_loss:.4f}',
                    'MSE': f'{total_mse / (batch_idx + 1):.4f}'
                })

        # Calculate epoch averages
        num_batches = len(self.val_loader)
        avg_loss = total_loss / num_batches
        avg_mse = total_mse / num_batches
        avg_ranking = total_ranking / num_batches

        # Calculate additional metrics
        predictions_np = np.array(all_predictions)
        targets_np = np.array(all_targets)

        mae = np.mean(np.abs(predictions_np - targets_np))
        correlation = np.corrcoef(predictions_np, targets_np)[0, 1]

        return avg_loss, avg_mse, avg_ranking, mae, correlation

    def save_checkpoint(self, epoch, is_best=False):
        """Save model checkpoint."""
        checkpoint = {
            'epoch': epoch,
            'model_state_dict': self.model.state_dict(),
            'optimizer_state_dict': self.optimizer.state_dict(),
            'best_val_loss': self.best_val_loss,
            'train_losses': self.train_losses,
            'val_losses': self.val_losses,
            'config': self.config,
            'model_info': self.model_info
        }

        if self.scheduler is not None:
            checkpoint['scheduler_state_dict'] = self.scheduler.state_dict()

        # Save latest checkpoint
        checkpoint_path = self.output_dir / 'latest_checkpoint.pth'
        torch.save(checkpoint, checkpoint_path)

        # Save best model
        if is_best:
            best_path = self.output_dir / 'best_model.pth'
            torch.save(checkpoint, best_path)
            print(f"New best model saved! Val loss: {self.best_val_loss:.4f}")

    def load_checkpoint(self, checkpoint_path):
        """Load checkpoint to continue training."""
        print(f"Loading checkpoint from: {checkpoint_path}")

        checkpoint = torch.load(checkpoint_path, map_location=self.device)

        # Load model and optimizer state
        self.model.load_state_dict(checkpoint['model_state_dict'])
        self.optimizer.load_state_dict(checkpoint['optimizer_state_dict'])

        # Load training state
        self.best_val_loss = checkpoint['best_val_loss']
        self.train_losses = checkpoint.get('train_losses', [])
        self.val_losses = checkpoint.get('val_losses', [])

        # Load scheduler state if exists
        if self.scheduler is not None and 'scheduler_state_dict' in checkpoint:
            self.scheduler.load_state_dict(checkpoint['scheduler_state_dict'])

        start_epoch = checkpoint['epoch'] + 1
        self.start_epoch = start_epoch

        print(f"Resuming training from epoch {start_epoch}")
        print(f"Previous best validation loss: {self.best_val_loss:.4f}")

        return start_epoch

    def plot_training_curves(self):
        """Plot and save training curves."""
        fig, axes = plt.subplots(1, 2, figsize=(15, 5))

        epochs = range(1, len(self.train_losses) + 1)

        # Loss curves
        axes[0].plot(epochs, self.train_losses, 'b-', label='Train Loss')
        axes[0].plot(epochs, self.val_losses, 'r-', label='Val Loss')
        axes[0].set_title('Training and Validation Loss')
        axes[0].set_xlabel('Epoch')
        axes[0].set_ylabel('Loss')
        axes[0].legend()
        axes[0].grid(True)

        # Learning rate
        if self.learning_rates:
            axes[1].plot(epochs, self.learning_rates, 'g-')
            axes[1].set_title('Learning Rate')
            axes[1].set_xlabel('Epoch')
            axes[1].set_ylabel('Learning Rate')
            axes[1].set_yscale('log')
            axes[1].grid(True)

        plt.tight_layout()
        plt.savefig(
            self.output_dir /
            'training_curves.png',
            dpi=150,
            bbox_inches='tight')
        plt.close()

    def train(self):
        """Main training loop."""
        print(f"\nStarting training for {self.config['epochs']} epochs...")
        start_time = time.time()
        
        # Handle resume - start from resumed epoch if available
        start_epoch = getattr(self, 'start_epoch', 0)

        for epoch in range(start_epoch, self.config['epochs']):
            epoch_start = time.time()

            # Training
            train_loss, train_mse, train_ranking = self.train_epoch(epoch)

            # Validation
            val_loss, val_mse, val_ranking, val_mae, val_corr = self.validate_epoch(
            epoch)

            # Store metrics
            self.train_losses.append(train_loss)
            self.val_losses.append(val_loss)
            self.learning_rates.append(self.optimizer.param_groups[0]['lr'])

            # Update scheduler
            if self.scheduler is not None:
                if isinstance(self.scheduler, ReduceLROnPlateau):
                    self.scheduler.step(val_loss)
                else:
                    self.scheduler.step()

            # Save checkpoint
            is_best = val_loss < self.best_val_loss
            if is_best:
                self.best_val_loss = val_loss

            self.save_checkpoint(epoch, is_best)

            # Print epoch summary
            epoch_time = time.time() - epoch_start
            print(f"\nEpoch {epoch+1}/{self.config['epochs']} Summary:")
            print(f"  Train Loss: {train_loss:.4f} (MSE: {train_mse:.4f})")
            print(f"  Val Loss:   {val_loss:.4f} (MSE: {val_mse:.4f})")
            print(f"  Val MAE:    {val_mae:.4f}")
            print(f"  Val Corr:   {val_corr:.4f}")
            print(f"  Time:       {epoch_time:.1f}s")
            print(f"  LR:         {self.optimizer.param_groups[0]['lr']:.6f}")

            # Plot training curves every 10 epochs
            if (epoch + 1) % 10 == 0:
                self.plot_training_curves()

        total_time = time.time() - start_time
        print(f"\nTraining completed in {total_time/60:.1f} minutes!")
        print(f"Best validation loss: {self.best_val_loss:.4f}")

        # Final plots
        self.plot_training_curves()

        # Save final training history
        history = {
            'train_losses': self.train_losses,
            'val_losses': self.val_losses,
            'learning_rates': self.learning_rates,
            'best_val_loss': self.best_val_loss,
            'total_training_time': total_time,
            'config': self.config
        }

        with open(self.output_dir / 'training_history.json', 'w') as f:
            json.dump(history, f, indent=2, default=str)

def get_default_config():
    """Get default training configuration."""
    return {
        # Data paths
        'csv_path': '../datasets/ground_truth_dataset.csv',
        'images_path': '../datasets/images',
        'output_dir': 'outputs',

        # Model
        'backbone': 'resnet50',
        'pretrained': True,

        # Training
        'epochs': 20,
        'batch_size': 16,
        'learning_rate': 1e-4,
        'optimizer': 'adam',
        'weight_decay': 1e-4,
        'gradient_clip': 1.0,
        'scheduler': 'reduce_on_plateau',

        # Data
        'val_split': 0.15,
        'test_split': 0.15,
        'num_workers': 0,
        'random_seed': 42
    }

def main():
    """Main training function."""
    parser = argparse.ArgumentParser(
        description='Train Photography Evaluation Model')
    parser.add_argument(
        '--config',
        type=str,
        default=None,
        help='Path to config JSON file')
    parser.add_argument(
        '--epochs',
        type=int,
        default=50,
        help='Number of epochs')
    parser.add_argument(
        '--batch_size',
        type=int,
        default=32,
        help='Batch size')
    parser.add_argument('--lr', type=float, default=1e-4, help='Learning rate')
    parser.add_argument(
        '--backbone',
        type=str,
        default='resnet50',
        help='Model backbone')
    parser.add_argument(
        '--output_dir',
        type=str,
        default='outputs',
        help='Output directory')
    parser.add_argument('--resume', type=str, default=None,
                        help='Path to checkpoint to resume from')

    args = parser.parse_args()

    # Load configuration
    if args.config and os.path.exists(args.config):
        with open(args.config, 'r') as f:
            config = json.load(f)
    else:
        config = get_default_config()

    # Override with command line arguments BEFORE creating trainer
    if args.epochs != 50:
        config['epochs'] = args.epochs
    if args.batch_size != 32:
        config['batch_size'] = args.batch_size
    if args.lr != 1e-4:
        config['learning_rate'] = args.lr
    if args.backbone != 'resnet50':
        config['backbone'] = args.backbone
    if args.output_dir != 'outputs':
        config['output_dir'] = args.output_dir

    # Add timestamp to output directory (only if NOT resuming)
    if not args.resume:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        config['output_dir'] = f"{config['output_dir']}/run_{timestamp}"

    print("Training Configuration:")
    for key, value in config.items():
        print(f"  {key}: {value}")

    # Create trainer and setup
    trainer = ModelTrainer(config)
    trainer.setup_data_loaders()
    trainer.setup_model()

    # Resume from checkpoint if specified
    if args.resume:
        trainer.load_checkpoint(args.resume)

    # Start training
    trainer.train()

    print("\nTraining completed successfully!")
    print(f"Results saved to: {trainer.output_dir}")

if __name__ == "__main__":
    main()