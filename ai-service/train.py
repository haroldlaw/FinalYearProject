import torch
import torch.nn as nn
import torch.optim as optim
from torch.optim.lr_scheduler import ReduceLROnPlateau, StepLR, CosineAnnealingLR, LinearLR, SequentialLR
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
        'warmup_epochs': 0,
        'warmup_start_factor': 0.1,
        'pretrained_backbone': None,  # path to AVA pretrained checkpoint
        'freeze_backbone_epochs': 0,   # freeze backbone for first N epochs (0 = never)
        'backbone_lr': None,           # lr for backbone after unfreezing (None = same as lr)
        
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

        # Load AVA-pretrained backbone weights if provided
        pretrained_backbone = self.config.get('pretrained_backbone')
        if pretrained_backbone:
            ckpt_path = Path(pretrained_backbone)
            if ckpt_path.exists():
                print(f"Loading AVA pretrained backbone from: {ckpt_path}")
                checkpoint = torch.load(ckpt_path, map_location=self.device)
                # Checkpoint may store backbone weights directly or inside model_state_dict
                if 'backbone_state_dict' in checkpoint:
                    missing, unexpected = self.model.backbone.load_state_dict(
                        checkpoint['backbone_state_dict'], strict=False
                    )
                elif 'model_state_dict' in checkpoint:
                    # Extract backbone keys from full model state dict
                    full_sd = checkpoint['model_state_dict']
                    backbone_sd = {k.replace('backbone.', ''): v
                                   for k, v in full_sd.items() if k.startswith('backbone.')}
                    missing, unexpected = self.model.backbone.load_state_dict(
                        backbone_sd, strict=False
                    )
                else:
                    missing, unexpected = self.model.backbone.load_state_dict(
                        checkpoint, strict=False
                    )
                print(f"  Backbone loaded  |  missing={len(missing)}  unexpected={len(unexpected)}")
            else:
                print(f"⚠️  pretrained_backbone path not found: {ckpt_path}")
        
        # Freeze backbone for first N epochs if requested
        freeze_epochs = int(self.config.get('freeze_backbone_epochs', 0) or 0)
        if freeze_epochs > 0:
            for param in self.model.backbone.parameters():
                param.requires_grad = False
            trainable = sum(p.numel() for p in self.model.parameters() if p.requires_grad)
            print(f"  Backbone frozen for first {freeze_epochs} epochs  |  trainable params: {trainable:,}")
        
        # Save model info
        with open(self.output_dir / 'model_info.json', 'w') as f:
            json.dump(self.model_info, f, indent=2)
    
    def _build_param_groups(self):
        """Build optimizer parameter groups with optional differential lr for backbone."""
        backbone_frozen = not any(p.requires_grad for p in self.model.backbone.parameters())
        backbone_lr = self.config.get('backbone_lr')
        head_lr = self.config['learning_rate']
        wd = self.config['weight_decay']

        if backbone_frozen or backbone_lr is None:
            # Single group — all trainable params at same lr
            return self.model.parameters(), head_lr
        else:
            # Two groups — backbone at backbone_lr, heads at head_lr
            backbone_params = list(self.model.backbone.parameters())
            backbone_ids = {id(p) for p in backbone_params}
            head_params = [p for p in self.model.parameters() if id(p) not in backbone_ids]
            return [
                {'params': backbone_params, 'lr': backbone_lr, 'weight_decay': wd},
                {'params': head_params,    'lr': head_lr,     'weight_decay': wd},
            ], head_lr

    def setup_optimizer(self):
        """Setup optimizer."""
        param_groups, base_lr = self._build_param_groups()
        if self.config['optimizer'] == 'adam':
            self.optimizer = optim.Adam(
                param_groups,
                lr=base_lr,
                weight_decay=self.config['weight_decay']
            )
        elif self.config['optimizer'] == 'adamw':
            self.optimizer = optim.AdamW(
                param_groups,
                lr=base_lr,
                weight_decay=self.config['weight_decay']
            )
        elif self.config['optimizer'] == 'sgd':
            self.optimizer = optim.SGD(
                param_groups,
                lr=base_lr,
                momentum=0.9,
                weight_decay=self.config['weight_decay']
            )
        else:
            raise ValueError(f"Unsupported optimizer: {self.config['optimizer']}")
        
        backbone_lr = self.config.get('backbone_lr')
        if backbone_lr and not (not any(p.requires_grad for p in self.model.backbone.parameters())):
            print(f"Optimizer: {self.config['optimizer']} (backbone_lr={backbone_lr}, head_lr={self.config['learning_rate']}, wd={self.config['weight_decay']})")
        else:
            print(f"Optimizer: {self.config['optimizer']} (lr={self.config['learning_rate']}, wd={self.config['weight_decay']})")
    
    def setup_scheduler(self):
        """Setup learning rate scheduler."""
        warmup_epochs = int(self.config.get('warmup_epochs', 0) or 0)
        warmup_start_factor = float(self.config.get('warmup_start_factor', 0.1))

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
            if warmup_start_factor <= 0 or warmup_start_factor > 1:
                print(f"⚠️  Invalid warmup_start_factor={warmup_start_factor}. Resetting to 0.1")
                warmup_start_factor = 0.1

            max_warmup = max(self.config['epochs'] - 1, 0)
            effective_warmup = min(warmup_epochs, max_warmup)

            if effective_warmup > 0:
                cosine_epochs = max(self.config['epochs'] - effective_warmup, 1)
                warmup_scheduler = LinearLR(
                    self.optimizer,
                    start_factor=warmup_start_factor,
                    end_factor=1.0,
                    total_iters=effective_warmup
                )
                cosine_scheduler = CosineAnnealingLR(
                    self.optimizer,
                    T_max=cosine_epochs,
                    eta_min=1e-6
                )
                self.scheduler = SequentialLR(
                    self.optimizer,
                    schedulers=[warmup_scheduler, cosine_scheduler],
                    milestones=[effective_warmup]
                )
                print(f"Warmup: {effective_warmup} epochs (start_factor={warmup_start_factor})")
            else:
                self.scheduler = CosineAnnealingLR(
                    self.optimizer,
                    T_max=self.config['epochs'],
                    eta_min=1e-6
                )
        else:
            self.scheduler = None
        
        print(f"Scheduler: {self.config['scheduler']}")

    def unfreeze_backbone(self):
        """Unfreeze backbone and rebuild optimizer/scheduler with differential lr."""
        print(f"\n{'='*60}")
        print(f"Unfreezing backbone at epoch {self.current_epoch + 1}")
        for param in self.model.backbone.parameters():
            param.requires_grad = True
        total = sum(p.numel() for p in self.model.parameters())
        trainable = sum(p.numel() for p in self.model.parameters() if p.requires_grad)
        print(f"  Trainable params: {trainable:,} / {total:,}")

        # Rebuild optimizer with param groups
        backbone_lr = self.config.get('backbone_lr') or self.config['learning_rate']
        self.config['backbone_lr'] = backbone_lr  # ensure it's set for _build_param_groups
        param_groups, base_lr = self._build_param_groups()
        if self.config['optimizer'] == 'adam':
            self.optimizer = optim.Adam(param_groups, lr=base_lr, weight_decay=self.config['weight_decay'])
        elif self.config['optimizer'] == 'adamw':
            self.optimizer = optim.AdamW(param_groups, lr=base_lr, weight_decay=self.config['weight_decay'])
        elif self.config['optimizer'] == 'sgd':
            self.optimizer = optim.SGD(param_groups, lr=base_lr, momentum=0.9, weight_decay=self.config['weight_decay'])
        print(f"  Optimizer rebuilt  |  backbone_lr={backbone_lr}  head_lr={self.config['learning_rate']}")

        # Rebuild scheduler for remaining epochs
        remaining = self.config['epochs'] - self.current_epoch
        if self.config['scheduler'] == 'cosine':
            self.scheduler = CosineAnnealingLR(self.optimizer, T_max=max(remaining, 1), eta_min=1e-6)
            print(f"  Scheduler rebuilt  |  cosine over {remaining} remaining epochs")
        elif self.config['scheduler'] == 'reduce_on_plateau':
            self.scheduler = ReduceLROnPlateau(self.optimizer, mode='min', factor=0.5, patience=5)
        print(f"{'='*60}\n")

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
        
        freeze_epochs = int(self.config.get('freeze_backbone_epochs', 0) or 0)

        for epoch in range(self.config['epochs']):
            self.current_epoch = epoch

            # Unfreeze backbone when freeze phase ends
            if freeze_epochs > 0 and epoch == freeze_epochs:
                self.unfreeze_backbone()
            
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
    parser.add_argument('--scheduler', type=str, default=None,
                        choices=['reduce_on_plateau', 'step', 'cosine', 'none'],
                        help='LR scheduler')
    parser.add_argument('--warmup_epochs', type=int, default=None,
                        help='Warmup epochs (used with cosine scheduler)')
    parser.add_argument('--warmup_start_factor', type=float, default=None,
                        help='Warmup LR start factor in (0, 1]')
    parser.add_argument('--pretrained_backbone', type=str, default=None,
                        help='Path to AVA pretrained checkpoint to load backbone weights from')
    parser.add_argument('--freeze_backbone_epochs', type=int, default=None,
                        help='Freeze backbone for first N epochs, then unfreeze with backbone_lr')
    parser.add_argument('--backbone_lr', type=float, default=None,
                        help='LR for backbone after unfreezing (default: same as --lr)')
    
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
    if args.scheduler is not None:
        config['scheduler'] = None if args.scheduler == 'none' else args.scheduler
    if args.warmup_epochs is not None:
        config['warmup_epochs'] = max(args.warmup_epochs, 0)
    if args.warmup_start_factor is not None:
        config['warmup_start_factor'] = args.warmup_start_factor
    if args.pretrained_backbone is not None:
        config['pretrained_backbone'] = args.pretrained_backbone
    if args.freeze_backbone_epochs is not None:
        config['freeze_backbone_epochs'] = max(args.freeze_backbone_epochs, 0)
    if args.backbone_lr is not None:
        config['backbone_lr'] = args.backbone_lr
    
    # Print configuration
    print(f"\n{'='*60}")
    print(f"Training Configuration:")
    print(f"  Backbone: {config['backbone']}")
    print(f"  Optimizer: {config['optimizer']}")
    print(f"  Scheduler: {config['scheduler']}")
    print(f"  Warmup Epochs: {config.get('warmup_epochs', 0)}")
    print(f"  Warmup Start Factor: {config.get('warmup_start_factor', 0.1)}")
    print(f"  Pretrained Backbone: {config.get('pretrained_backbone') or 'ImageNet only'}")
    print(f"  Freeze Backbone Epochs: {config.get('freeze_backbone_epochs', 0)}")
    print(f"  Backbone LR (after unfreeze): {config.get('backbone_lr') or 'same as lr'}")
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