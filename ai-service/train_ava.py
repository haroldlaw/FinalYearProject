"""
AVA Pretraining Script
======================
Pretrains a ResNet-50 backbone on the AVA aesthetic dataset using a
single global score regression head (MSE, 0-100 scale).

The saved checkpoint can then be used to initialise the AADB fine-tuning
run via train.py --pretrained_backbone <path>.

Usage:
    cd ai-service
    python train_ava.py

Key paths (points to Downloads folder - avoids OneDrive sync overhead):
    AVA.txt  : C:\\Users\\harold\\Downloads\\archive\\AVA_Files\\AVA.txt
    images/  : C:\\Users\\harold\\Downloads\\archive\\images\\
"""

import argparse
import json
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.optim.lr_scheduler import CosineAnnealingLR, LinearLR, SequentialLR
from torchvision import models
from tqdm import tqdm

from ava_dataset import create_ava_data_loaders


# ---------------------------------------------------------------------------
# Model
# ---------------------------------------------------------------------------

class AVAScoreModel(nn.Module):
    """
    ResNet-50 backbone + single global aesthetic score head.
    Output: scalar in 0-100 range.
    """

    def __init__(self, backbone='resnet50', pretrained=True, dropout=0.5):
        super().__init__()
        self.backbone_name = backbone

        if backbone == 'resnet50':
            base = models.resnet50(pretrained=pretrained)
            base.fc = nn.Identity()
            self.backbone = base
            feat_dim = 2048
        elif backbone == 'resnet34':
            base = models.resnet34(pretrained=pretrained)
            base.fc = nn.Identity()
            self.backbone = base
            feat_dim = 512
        else:
            raise ValueError(f"Unsupported backbone: {backbone}")

        self.head = nn.Sequential(
            nn.Dropout(dropout),
            nn.Linear(feat_dim, 512),
            nn.BatchNorm1d(512),
            nn.ReLU(inplace=True),
            nn.Dropout(dropout / 2),
            nn.Linear(512, 1),
        )

    def forward(self, x):
        features = self.backbone(x)
        score = torch.clamp(self.head(features), 0.0, 100.0)
        return score.squeeze(1)  # (B,)


# ---------------------------------------------------------------------------
# Trainer
# ---------------------------------------------------------------------------

class AVATrainer:
    def __init__(self, config):
        self.config = config
        self.device = self._setup_device()
        self.output_dir = Path(config['output_dir'])
        self.output_dir.mkdir(parents=True, exist_ok=True)

        torch.manual_seed(config['random_seed'])
        np.random.seed(config['random_seed'])

        # Data
        print("\nLoading AVA dataset...")
        self.train_loader, self.val_loader, self.split_info = create_ava_data_loaders(
            ava_txt_path=config['ava_txt_path'],
            images_path=config['images_path'],
            batch_size=config['batch_size'],
            num_workers=config['num_workers'],
            val_split=config['val_split'],
            random_seed=config['random_seed'],
        )
        with open(self.output_dir / 'split_info.json', 'w') as f:
            json.dump(self.split_info, f, indent=2)

        # Model
        print(f"\nBuilding {config['backbone']} model...")
        self.model = AVAScoreModel(
            backbone=config['backbone'],
            pretrained=config['pretrained'],
            dropout=config['dropout'],
        ).to(self.device)

        n_params = sum(p.numel() for p in self.model.parameters())
        print(f"  Parameters: {n_params:,}  |  Device: {self.device}")

        self.criterion = nn.MSELoss()

        # Optimiser
        self.optimizer = optim.Adam(
            self.model.parameters(),
            lr=config['learning_rate'],
            weight_decay=config['weight_decay'],
        )

        # Scheduler: linear warmup → cosine
        warmup = config['warmup_epochs']
        cosine_epochs = max(config['epochs'] - warmup, 1)
        if warmup > 0:
            warmup_sched = LinearLR(
                self.optimizer,
                start_factor=config['warmup_start_factor'],
                end_factor=1.0,
                total_iters=warmup,
            )
            cosine_sched = CosineAnnealingLR(
                self.optimizer,
                T_max=cosine_epochs,
                eta_min=1e-6,
            )
            self.scheduler = SequentialLR(
                self.optimizer,
                schedulers=[warmup_sched, cosine_sched],
                milestones=[warmup],
            )
            print(f"  Warmup: {warmup} epochs → cosine {cosine_epochs} epochs")
        else:
            self.scheduler = CosineAnnealingLR(
                self.optimizer,
                T_max=config['epochs'],
                eta_min=1e-6,
            )

        self.best_val_loss = float('inf')
        self.train_losses = []
        self.val_losses = []

        # Save config
        with open(self.output_dir / 'config.json', 'w') as f:
            json.dump(config, f, indent=2)

        print(f"\nOutput directory: {self.output_dir}")

    def _setup_device(self):
        if torch.cuda.is_available():
            d = torch.device('cuda')
            print(f"✅ CUDA GPU: {torch.cuda.get_device_name(0)}")
        elif torch.backends.mps.is_available():
            d = torch.device('mps')
            print("✅ Apple MPS")
        else:
            d = torch.device('cpu')
            print("⚠️  CPU only")
        return d

    def _run_epoch(self, loader, train=True):
        self.model.train() if train else self.model.eval()
        total_loss = 0.0
        mode = "Train" if train else "Val"
        epoch_str = f"{self.current_epoch + 1}/{self.config['epochs']}"

        ctx = torch.enable_grad() if train else torch.no_grad()
        with ctx:
            pbar = tqdm(loader, desc=f"Epoch {epoch_str} [{mode}]", leave=False)
            for images, targets in pbar:
                images = images.to(self.device, non_blocking=True)
                targets = targets.to(self.device, non_blocking=True)

                if train:
                    self.optimizer.zero_grad()

                preds = self.model(images)
                loss = self.criterion(preds, targets)

                if train:
                    loss.backward()
                    if self.config['gradient_clip'] > 0:
                        nn.utils.clip_grad_norm_(
                            self.model.parameters(), self.config['gradient_clip']
                        )
                    self.optimizer.step()

                total_loss += loss.item()
                pbar.set_postfix({'loss': f"{loss.item():.4f}"})

        return total_loss / len(loader)

    def train(self):
        print(f"\n{'='*60}")
        print(f"AVA Pretraining: {self.config['epochs']} epochs")
        print(f"{'='*60}\n")

        start = time.time()

        for epoch in range(self.config['epochs']):
            self.current_epoch = epoch

            train_loss = self._run_epoch(self.train_loader, train=True)
            val_loss = self._run_epoch(self.val_loader, train=False)

            self.scheduler.step()

            self.train_losses.append(train_loss)
            self.val_losses.append(val_loss)

            is_best = val_loss < self.best_val_loss
            if is_best:
                self.best_val_loss = val_loss
                self._save(best=True)
            self._save(best=False)

            marker = " ✅ BEST" if is_best else ""
            print(
                f"Epoch {epoch + 1:3d}/{self.config['epochs']}  "
                f"train={train_loss:.4f}  val={val_loss:.4f}{marker}"
            )

        elapsed = time.time() - start
        print(f"\n{'='*60}")
        print(f"Pretraining complete  |  {elapsed/3600:.2f}h")
        print(f"Best val MSE: {self.best_val_loss:.4f}")
        print(f"Backbone saved to: {self.output_dir / 'best_model.pth'}")
        print(f"{'='*60}\n")

    def _save(self, best=False):
        checkpoint = {
            'epoch': self.current_epoch,
            'model_state_dict': self.model.state_dict(),
            'backbone_state_dict': self.model.backbone.state_dict(),
            'optimizer_state_dict': self.optimizer.state_dict(),
            'best_val_loss': self.best_val_loss,
            'train_losses': self.train_losses,
            'val_losses': self.val_losses,
            'config': self.config,
        }
        path = self.output_dir / ('best_model.pth' if best else 'latest_checkpoint.pth')
        torch.save(checkpoint, path)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description='Pretrain on AVA aesthetic dataset')
    parser.add_argument('--ava_txt',    type=str,   default=r'C:\Users\harold\Downloads\archive\AVA_Files\AVA.txt')
    parser.add_argument('--images_dir', type=str,   default=r'C:\Users\harold\Downloads\archive\images')
    parser.add_argument('--output_dir', type=str,   default='outputs/ava_pretrain')
    parser.add_argument('--backbone',   type=str,   default='resnet50')
    parser.add_argument('--epochs',     type=int,   default=30)
    parser.add_argument('--batch_size', type=int,   default=32)
    parser.add_argument('--lr',         type=float, default=1e-4)
    parser.add_argument('--weight_decay', type=float, default=1e-4)
    parser.add_argument('--dropout',    type=float, default=0.5)
    parser.add_argument('--warmup_epochs', type=int, default=3)
    parser.add_argument('--warmup_start_factor', type=float, default=0.1)
    parser.add_argument('--val_split',  type=float, default=0.05)
    parser.add_argument('--num_workers', type=int,  default=4)
    parser.add_argument('--gradient_clip', type=float, default=1.0)
    parser.add_argument('--random_seed', type=int,  default=42)
    parser.add_argument('--no_pretrained', action='store_true',
                        help='Do not use ImageNet pretrained weights')
    args = parser.parse_args()

    config = {
        'ava_txt_path': args.ava_txt,
        'images_path': args.images_dir,
        'output_dir': args.output_dir,
        'backbone': args.backbone,
        'pretrained': not args.no_pretrained,
        'epochs': args.epochs,
        'batch_size': args.batch_size,
        'learning_rate': args.lr,
        'weight_decay': args.weight_decay,
        'dropout': args.dropout,
        'warmup_epochs': args.warmup_epochs,
        'warmup_start_factor': args.warmup_start_factor,
        'val_split': args.val_split,
        'num_workers': args.num_workers,
        'gradient_clip': args.gradient_clip,
        'random_seed': args.random_seed,
    }

    print(f"\n{'='*60}")
    print("AVA Pretraining Configuration")
    for k, v in config.items():
        print(f"  {k}: {v}")
    print(f"{'='*60}\n")

    trainer = AVATrainer(config)
    trainer.train()


if __name__ == '__main__':
    main()
