import os
import torch
from torch.utils.data import Dataset, DataLoader
from PIL import Image
import torchvision.transforms as transforms
import numpy as np
from pathlib import Path


class AVADataset(Dataset):
    """
    AVA (Aesthetic Visual Analysis) Dataset.
    255,508 images with aesthetic scores from 1-10 ratings.
    Used for pretraining the backbone on general aesthetic quality.

    AVA.txt format (space-separated):
        col 0:    index
        col 1:    image_id
        cols 2-11: vote counts for scores 1 through 10
        cols 12-13: semantic tags (optional)
        col 14:   challenge_id
    """

    def __init__(self, image_ids, scores, images_path, transform=None):
        """
        Args:
            image_ids: list of image ID strings
            scores:    list of float aesthetic scores (0-100)
            images_path: path to AVA images folder
            transform: torchvision transforms
        """
        self.image_ids = image_ids
        self.scores = scores
        self.images_path = Path(images_path)
        self.transform = transform

    def __len__(self):
        return len(self.image_ids)

    def __getitem__(self, idx):
        img_id = self.image_ids[idx]
        score = self.scores[idx]

        img_path = self.images_path / f"{img_id}.jpg"
        try:
            image = Image.open(img_path).convert('RGB')
        except Exception:
            # Return a black image if file is missing/corrupt
            image = Image.new('RGB', (224, 224), (0, 0, 0))

        if self.transform:
            image = self.transform(image)

        return image, torch.tensor(score, dtype=torch.float32)


def parse_ava_txt(ava_txt_path):
    """
    Parse AVA.txt and return (image_ids, scores_0_100).

    Score formula:
        mean = sum(vote_i * i for i in 1..10) / sum(vote_i)
        normalized = (mean - 1) / 9 * 100   →  0-100 range
    """
    image_ids = []
    scores = []

    with open(ava_txt_path, 'r') as f:
        for line in f:
            parts = line.strip().split()
            if len(parts) < 12:
                continue

            img_id = parts[1]
            votes = np.array([float(x) for x in parts[2:12]])  # votes for scores 1-10
            total_votes = votes.sum()

            if total_votes == 0:
                continue

            score_values = np.arange(1, 11, dtype=float)
            mean_score = (votes * score_values).sum() / total_votes  # 1-10
            normalized = (mean_score - 1.0) / 9.0 * 100.0           # 0-100

            image_ids.append(img_id)
            scores.append(float(normalized))

    return image_ids, scores


def create_ava_data_loaders(
    ava_txt_path,
    images_path,
    batch_size=32,
    num_workers=4,
    val_split=0.05,
    random_seed=42,
):
    """
    Create train/val DataLoaders for AVA pretraining.

    Args:
        ava_txt_path:  path to AVA.txt
        images_path:   path to AVA images folder (jpg files named by ID)
        batch_size:    batch size
        num_workers:   DataLoader workers
        val_split:     fraction of data for validation (default 5%)
        random_seed:   reproducibility seed

    Returns:
        train_loader, val_loader, split_info dict
    """
    print(f"Parsing AVA.txt from: {ava_txt_path}")
    image_ids, scores = parse_ava_txt(ava_txt_path)
    print(f"  Total entries: {len(image_ids):,}")
    print(f"  Score range: {min(scores):.1f} - {max(scores):.1f}")
    print(f"  Mean score: {np.mean(scores):.1f}")

    # Filter to images that actually exist (single directory scan — much faster than per-file checks)
    images_path = Path(images_path)
    print("Scanning images directory...")
    available_ids = {p.stem for p in images_path.iterdir() if p.suffix.lower() == '.jpg'}
    print(f"  Found {len(available_ids):,} jpg files on disk")

    valid_ids = []
    valid_scores = []
    for img_id, score in zip(image_ids, scores):
        if img_id in available_ids:
            valid_ids.append(img_id)
            valid_scores.append(score)

    print(f"  Matched: {len(valid_ids):,} / {len(image_ids):,} entries")

    # Train/val split
    rng = np.random.default_rng(random_seed)
    indices = np.arange(len(valid_ids))
    rng.shuffle(indices)

    n_val = int(len(indices) * val_split)
    val_idx = indices[:n_val]
    train_idx = indices[n_val:]

    train_ids = [valid_ids[i] for i in train_idx]
    train_scores = [valid_scores[i] for i in train_idx]
    val_ids = [valid_ids[i] for i in val_idx]
    val_scores = [valid_scores[i] for i in val_idx]

    print(f"  Train: {len(train_ids):,}  |  Val: {len(val_ids):,}")

    # Transforms
    train_transform = transforms.Compose([
        transforms.Resize((256, 256)),
        transforms.RandomCrop(224),
        transforms.RandomHorizontalFlip(),
        transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406],
                             std=[0.229, 0.224, 0.225]),
    ])

    val_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406],
                             std=[0.229, 0.224, 0.225]),
    ])

    train_dataset = AVADataset(train_ids, train_scores, images_path, train_transform)
    val_dataset = AVADataset(val_ids, val_scores, images_path, val_transform)

    train_loader = DataLoader(
        train_dataset,
        batch_size=batch_size,
        shuffle=True,
        num_workers=num_workers,
        pin_memory=True,
        persistent_workers=(num_workers > 0),
        prefetch_factor=2 if num_workers > 0 else None,
    )

    val_loader = DataLoader(
        val_dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        pin_memory=True,
        persistent_workers=(num_workers > 0),
        prefetch_factor=2 if num_workers > 0 else None,
    )

    split_info = {
        'total': len(valid_ids),
        'train': len(train_ids),
        'val': len(val_ids),
        'val_split': val_split,
        'score_mean': float(np.mean(valid_scores)),
        'score_std': float(np.std(valid_scores)),
    }

    return train_loader, val_loader, split_info
