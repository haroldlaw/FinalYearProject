import torch
import torch.nn as nn
import torch.optim as optim
from torch.optim.lr_scheduler import ReduceLROnPlateau, StepLR, CosineAnnealingLR
import argparse
import json
import time
from pathlib import Path
from datetime import datetime
from tqdm import tqdm
import numpy as np

from dataset import create_data_loaders
from model import create_model, MultiAttributeLoss


def get_default_config(backbone='resnet50'):
    """Get default training configuration based on backbone type."""
    
    # Base config
    config = {
        # AADB paths - using individual attribute files (all 11 attributes)
        'train_labels_path': '../datasets/AADB/imgListFiles_label',
        'test_labels_path': '../datasets/AADB/imgListFiles_label',
        'images_path': '../datasets/AADB/datasetImages_originalSize',
        'output_dir': 'outputs/aadb',
        
        # Model
        'backbone': backbone,
        'pretrained': True,
        
        # Training
        'epochs': 50,
        'batch_size': 16,
        'gradient_clip': 1.0,
        
        # Data
        'val_split': 0.15,
        'num_workers': 4,
        'random_seed': 42
    }
    
    # ViT-specific defaults (standard practice for Vision Transformers)
    if backbone.startswith('vit_'):
        config.update({
            'optimizer': 'adamw',
            'learning_rate': 3e-4,  # Slightly higher for ViT
            'weight_decay': 0.05,   # Higher for ViT
            'scheduler': 'cosine',
        })
    # CNN defaults (ResNet, EfficientNet)
    else:
        config.update({
            'optimizer': 'adam',
            'learning_rate': 1e-4,
            'weight_decay': 1e-4,
            'scheduler': 'reduce_on_plateau',
        })
    
    return config


class Trainer:
    """Training manager for photography evaluation model."""
    
    def __init__(self, config):
        self.config = config
        self.device = self._setup_device()
        self.output_dir = Path(config['output_dir'])
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Set random seed
        torch.manual_seed(config['random_seed'])
        np.random.seed(config['random_seed'])
        
        # Setup components
        self.setup_data_loaders()
        self.setup_model()
        self.setup_optimizer()
        self.setup_scheduler()
        
        # Training state
        self.current_epoch = 0
        self.best_val_loss = float('inf')
        self.train_losses = []
        self.val_losses = []
        
        # Save config
        with open(self.output_dir / 'config.json', 'w') as f:
            json.dump(config, f, indent=2)
        
        print(f"\n{'='*60}")
        print(f"Trainer initialized")
        print(f"Output directory: {self.output_dir}")
        print(f"Device: {self.device}")
        print(f"{'='*60}\n")
    
    def _setup_device(self):
        """Setup compute device (MPS/CUDA/CPU)."""
        if torch.backends.mps.is_available():
            device = torch.device('mps')
            print("✅ Using Apple Silicon GPU (MPS)")
        elif torch.cuda.is_available():
            device = torch.device('cuda')
            print(f"✅ Using CUDA GPU: {torch.cuda.get_device_name(0)}")
        else:
            device = torch.device('cpu')
            print("⚠️  Using CPU (training will be slow)")
        return device
    
    def setup_data_loaders(self):
        """Setup AADB data loaders."""
        print("Setting up AADB data loaders...")
        
        self.train_loader, self.val_loader, self.test_loader, self.split_info = create_data_loaders(
            train_labels_path=self.config['train_labels_path'],
            test_labels_path=self.config['test_labels_path'],
            images_path=self.config['images_path'],
            batch_size=self.config['batch_size'],
            num_workers=self.config['num_workers'],
            val_split=self.config['val_split']
        )
    
    def setup_model(self):
        """Setup model and loss function."""
        print("\nSetting up model...")
        
        self.model, self.criterion, self.model_info = create_model(
            backbone=self.config['backbone'],
            pretrained=self.config['pretrained'],
            device=self.device
        )
        
        # Save model info
        with open(self.output_dir / 'model_info.json', 'w') as f:
            json.dump(self.model_info, f, indent=2)
    
    def setup_optimizer(self):
        """Setup optimizer."""
        if self.config['optimizer'] == 'adam':
            self.optimizer = optim.Adam(
                self.model.parameters(),
                lr=self.config['learning_rate'],
                weight_decay=self.config['weight_decay']
            )
        elif self.config['optimizer'] == 'adamw':
            self.optimizer = optim.AdamW(
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
            raise ValueError(f"Unsupported optimizer: {self.config['optimizer']}")
        
        print(f"Optimizer: {self.config['optimizer']} (lr={self.config['learning_rate']}, wd={self.config['weight_decay']})")
    
    def setup_scheduler(self):
        """Setup learning rate scheduler."""
        if self.config['scheduler'] == 'reduce_on_plateau':
            self.scheduler = ReduceLROnPlateau(
                self.optimizer,
                mode='min',
                factor=0.5,
                patience=5
            )
        elif self.config['scheduler'] == 'step':
            self.scheduler = StepLR(
                self.optimizer,
                step_size=10,
                gamma=0.1
            )
        elif self.config['scheduler'] == 'cosine':
            self.scheduler = CosineAnnealingLR(
                self.optimizer,
                T_max=self.config['epochs'],
                eta_min=1e-6
            )
        else:
            self.scheduler = None
        
        print(f"Scheduler: {self.config['scheduler']}")
    
    def train_epoch(self):
        """Train for one epoch."""
        self.model.train()
        
        total_loss = 0
        attr_losses = {
            'composition_score': 0,
            'color_score': 0,
            'focus_score': 0,
            'exposure_score': 0,
            'overall_score': 0
        }
        
        pbar = tqdm(self.train_loader, desc=f"Epoch {self.current_epoch + 1}/{self.config['epochs']} [Train]")
        
        for batch_idx, (images, targets, metadata) in enumerate(pbar):
            # Move to device
            images = images.to(self.device)
            targets = {k: v.to(self.device) for k, v in targets.items()}
            
            # Forward pass
            self.optimizer.zero_grad()
            predictions = self.model(images)
            loss, losses = self.criterion(predictions, targets)
            
            # Backward pass
            loss.backward()
            
            # Gradient clipping
            if self.config['gradient_clip'] > 0:
                torch.nn.utils.clip_grad_norm_(
                    self.model.parameters(),
                    self.config['gradient_clip']
                )
            
            self.optimizer.step()
            
            # Accumulate losses
            total_loss += loss.item()
            for key in attr_losses:
                attr_losses[key] += losses[key]
            
            # Update progress bar
            pbar.set_postfix({
                'loss': f"{loss.item():.4f}",
                'comp': f"{losses['composition_score']:.4f}",
                'color': f"{losses['color_score']:.4f}"
            })
        
        # Calculate average losses
        n_batches = len(self.train_loader)
        avg_loss = total_loss / n_batches
        avg_attr_losses = {k: v / n_batches for k, v in attr_losses.items()}
        
        return avg_loss, avg_attr_losses
    
    def validate_epoch(self):
        """Validate for one epoch."""
        self.model.eval()
        
        total_loss = 0
        attr_losses = {
            'composition_score': 0,
            'color_score': 0,
            'focus_score': 0,
            'exposure_score': 0,
            'overall_score': 0
        }
        
        with torch.no_grad():
            pbar = tqdm(self.val_loader, desc=f"Epoch {self.current_epoch + 1}/{self.config['epochs']} [Val]")
            
            for images, targets, metadata in pbar:
                # Move to device
                images = images.to(self.device)
                targets = {k: v.to(self.device) for k, v in targets.items()}
                
                # Forward pass
                predictions = self.model(images)
                loss, losses = self.criterion(predictions, targets)
                
                # Accumulate losses
                total_loss += loss.item()
                for key in attr_losses:
                    attr_losses[key] += losses[key]
                
                # Update progress bar
                pbar.set_postfix({
                    'loss': f"{loss.item():.4f}"
                })
        
        # Calculate average losses
        n_batches = len(self.val_loader)
        avg_loss = total_loss / n_batches
        avg_attr_losses = {k: v / n_batches for k, v in attr_losses.items()}
        
        return avg_loss, avg_attr_losses
    
    def save_checkpoint(self, is_best=False):
        """Save model checkpoint."""
        checkpoint = {
            'epoch': self.current_epoch,
            'model_state_dict': self.model.state_dict(),
            'optimizer_state_dict': self.optimizer.state_dict(),
            'best_val_loss': self.best_val_loss,
            'train_losses': self.train_losses,
            'val_losses': self.val_losses,
            'config': self.config
        }
        
        # Save latest checkpoint
        checkpoint_path = self.output_dir / 'latest_checkpoint.pth'
        torch.save(checkpoint, checkpoint_path)
        
        # Save best model
        if is_best:
            best_path = self.output_dir / 'best_model.pth'
            torch.save(checkpoint, best_path)
            print(f"✅ Best model saved! Val Loss: {self.best_val_loss:.4f}")
    
    def train(self):
        """Main training loop."""
        print(f"\n{'='*60}")
        print(f"Starting training for {self.config['epochs']} epochs")
        print(f"{'='*60}\n")
        
        start_time = time.time()
        
        for epoch in range(self.config['epochs']):
            self.current_epoch = epoch
            
            # Train
            train_loss, train_attr_losses = self.train_epoch()
            self.train_losses.append(train_loss)
            
            # Validate
            val_loss, val_attr_losses = self.validate_epoch()
            self.val_losses.append(val_loss)
            
            # Update scheduler
            if self.scheduler is not None:
                if isinstance(self.scheduler, ReduceLROnPlateau):
                    self.scheduler.step(val_loss)
                else:
                    self.scheduler.step()
            
            # Print epoch summary
            print(f"\nEpoch {epoch + 1}/{self.config['epochs']} Summary:")
            print(f"  Train Loss: {train_loss:.4f}")
            print(f"    Composition: {train_attr_losses['composition_score']:.4f}")
            print(f"    Color: {train_attr_losses['color_score']:.4f}")
            print(f"    Focus: {train_attr_losses['focus_score']:.4f}")
            print(f"    Exposure: {train_attr_losses['exposure_score']:.4f}")
            print(f"  Val Loss: {val_loss:.4f}")
            print(f"    Composition: {val_attr_losses['composition_score']:.4f}")
            print(f"    Color: {val_attr_losses['color_score']:.4f}")
            print(f"    Focus: {val_attr_losses['focus_score']:.4f}")
            print(f"    Exposure: {val_attr_losses['exposure_score']:.4f}")
            
            # Save checkpoint
            is_best = val_loss < self.best_val_loss
            if is_best:
                self.best_val_loss = val_loss
            
            self.save_checkpoint(is_best=is_best)
            
            print()
        
        # Training complete
        total_time = time.time() - start_time
        print(f"\n{'='*60}")
        print(f"Training Complete!")
        print(f"Total time: {total_time / 3600:.2f} hours")
        print(f"Best validation loss: {self.best_val_loss:.4f}")
        print(f"Model saved to: {self.output_dir / 'best_model.pth'}")
        print(f"{'='*60}\n")


def main():
    """Main training function."""
    parser = argparse.ArgumentParser(description='Train AADB photography evaluation model')
    parser.add_argument('--epochs', type=int, default=None, help='Number of epochs')
    parser.add_argument('--batch_size', type=int, default=None, help='Batch size')
    parser.add_argument('--lr', type=float, default=None, help='Learning rate')
    parser.add_argument('--backbone', type=str, default='resnet50', help='Backbone architecture (resnet50, vit_small_patch16_224, etc.)')
    parser.add_argument('--output_dir', type=str, default=None, help='Output directory')
    parser.add_argument('--optimizer', type=str, default=None, help='Optimizer (adam, adamw, sgd)')
    parser.add_argument('--weight_decay', type=float, default=None, help='Weight decay')
    
    args = parser.parse_args()
    
    # Get default config based on backbone (ViT vs CNN have different optimal settings)
    config = get_default_config(backbone=args.backbone)
    
    # Override with command line args
    if args.epochs is not None:
        config['epochs'] = args.epochs
    if args.batch_size is not None:
        config['batch_size'] = args.batch_size
    if args.lr is not None:
        config['learning_rate'] = args.lr
    if args.output_dir is not None:
        config['output_dir'] = args.output_dir
    if args.optimizer is not None:
        config['optimizer'] = args.optimizer
    if args.weight_decay is not None:
        config['weight_decay'] = args.weight_decay
    
    # Print configuration
    print(f"\n{'='*60}")
    print(f"Training Configuration:")
    print(f"  Backbone: {config['backbone']}")
    print(f"  Optimizer: {config['optimizer']}")
    print(f"  Learning Rate: {config['learning_rate']}")
    print(f"  Weight Decay: {config['weight_decay']}")
    print(f"  Epochs: {config['epochs']}")
    print(f"  Batch Size: {config['batch_size']}")
    print(f"{'='*60}\n")
    
    # Create trainer and train
    trainer = Trainer(config)
    trainer.train()


if __name__ == "__main__":
    main()