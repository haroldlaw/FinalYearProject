"""
Evaluate a trained model checkpoint and compute PLCC / SRCC on the test set.

Usage:
    python evaluate.py --checkpoint outputs/cnn_multi_attr/best_model.pth
    python evaluate.py --checkpoint outputs/vit/best_model.pth
    python evaluate.py --checkpoint outputs/cnn_multi_attr/best_model.pth --split val
"""

import argparse
import json
from pathlib import Path

import numpy as np
import torch
from scipy.stats import pearsonr, spearmanr
from tqdm import tqdm

from dataset import create_data_loaders
from model import create_model


ATTRIBUTES = ['composition_score', 'color_score', 'focus_score', 'exposure_score', 'overall_score']


def evaluate(checkpoint_path: str, split: str = 'test', labels_path: str = None, images_path: str = None):
    ckpt_path = Path(checkpoint_path)
    if not ckpt_path.exists():
        raise FileNotFoundError(f"Checkpoint not found: {ckpt_path}")

    # ── Device ────────────────────────────────────────────────────────────────
    if torch.backends.mps.is_available():
        device = torch.device('mps')
    elif torch.cuda.is_available():
        device = torch.device('cuda')
    else:
        device = torch.device('cpu')
    print(f"Device: {device}")

    # ── Load checkpoint ───────────────────────────────────────────────────────
    print(f"\nLoading checkpoint: {ckpt_path}")
    checkpoint = torch.load(ckpt_path, map_location=device, weights_only=False)

    config = checkpoint.get('config')
    if config is None:
        # Fall back to config.json next to checkpoint
        config_file = ckpt_path.parent / 'config.json'
        if config_file.exists():
            with open(config_file) as f:
                config = json.load(f)
        else:
            raise RuntimeError("No config found in checkpoint and no config.json alongside it.")

    backbone = config.get('backbone', 'resnet50')
    print(f"Backbone: {backbone}")

    # ── Model ─────────────────────────────────────────────────────────────────
    model, _, _ = create_model(backbone=backbone, pretrained=False, device=device)
    model.load_state_dict(checkpoint['model_state_dict'])
    model.eval()

    # ── Data ──────────────────────────────────────────────────────────────────
    print("\nBuilding data loaders...")
    train_loader, val_loader, test_loader, _ = create_data_loaders(
        train_labels_path=labels_path or config['train_labels_path'],
        test_labels_path=labels_path or config['test_labels_path'],
        images_path=images_path or config['images_path'],
        batch_size=config.get('batch_size', 16),
        num_workers=0,          # safer for evaluation
        val_split=config.get('val_split', 0.15),
    )

    loader = {'test': test_loader, 'val': val_loader, 'train': train_loader}[split]
    print(f"\nRunning inference on {split} split ({len(loader.dataset)} images)...")

    # ── Collect predictions and ground truth ──────────────────────────────────
    all_preds  = {attr: [] for attr in ATTRIBUTES}
    all_labels = {attr: [] for attr in ATTRIBUTES}

    with torch.no_grad():
        for images, targets, _ in tqdm(loader):
            images = images.to(device)
            preds = model(images)

            for attr in ATTRIBUTES:
                pred_vals = preds[attr].cpu().numpy()
                true_vals = targets[attr].numpy()
                # Handle scalar output when batch_size == 1
                all_preds[attr].extend(np.atleast_1d(pred_vals).tolist())
                all_labels[attr].extend(np.atleast_1d(true_vals).tolist())

    # ── Compute PLCC / SRCC ───────────────────────────────────────────────────
    print(f"\n{'='*60}")
    print(f"{'Attribute':<22} {'PLCC':>8} {'SRCC':>8} {'MAE':>8} {'RMSE':>8}")
    print(f"{'-'*60}")

    results = {}
    for attr in ATTRIBUTES:
        preds_arr  = np.array(all_preds[attr])
        labels_arr = np.array(all_labels[attr])

        plcc, _ = pearsonr(preds_arr, labels_arr)
        srcc, _ = spearmanr(preds_arr, labels_arr)
        mae  = float(np.mean(np.abs(preds_arr - labels_arr)))
        rmse = float(np.sqrt(np.mean((preds_arr - labels_arr) ** 2)))

        results[attr] = {'plcc': plcc, 'srcc': srcc, 'mae': mae, 'rmse': rmse}
        print(f"  {attr:<20} {plcc:>8.4f} {srcc:>8.4f} {mae:>8.2f} {rmse:>8.2f}")

    print(f"{'='*60}")

    # ── Save results ──────────────────────────────────────────────────────────
    out_file = ckpt_path.parent / f'eval_{split}.json'
    with open(out_file, 'w') as f:
        json.dump(results, f, indent=2)
    print(f"\nResults saved to: {out_file}")

    return results


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Evaluate a trained AADB model.')
    parser.add_argument('--checkpoint', required=True, help='Path to best_model.pth')
    parser.add_argument('--split', default='test', choices=['test', 'val', 'train'],
                        help='Dataset split to evaluate on (default: test)')
    parser.add_argument('--labels', default=None,
                        help='Override path to imgListFiles_label directory')
    parser.add_argument('--images', default=None,
                        help='Override path to datasetImages_originalSize directory')
    args = parser.parse_args()
    evaluate(args.checkpoint, split=args.split, labels_path=args.labels, images_path=args.images)
