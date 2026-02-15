import os
import pandas as pd
import torch
from torch.utils.data import Dataset, DataLoader
from PIL import Image
import torchvision.transforms as transforms
from sklearn.model_selection import train_test_split
import numpy as np
from pathlib import Path
import json

class AVAPhotographyDataset(Dataset):
    """
    AVA Dataset loader for photography aesthetic evaluation.
    Handles image loading, score normalization, and data augmentation.
    """
    
    def __init__(self, df, images_path, transform=None, score_range=(0, 100)):
        """
        Initialize dataset with pre-split DataFrame.
        
        Args:
            df (pandas.DataFrame): Pre-filtered dataframe with image data
            images_path (str): Path to images directory
            transform (torchvision.transforms): Image transformations
            score_range (tuple): Target score range (default 0-100)
        """
        self.df = df.copy()
        self.images_path = Path(images_path)
        self.transform = transform
        self.score_range = score_range
        
        # Calculate aesthetic scores if not already present
        if 'avg_score' not in self.df.columns:
            self._calculate_aesthetic_scores()
        
        # Convert to target score range
        self._normalize_target_scores()
        
        # Filter out missing images
        self._filter_existing_images()
        
        print(f"Dataset initialized: {len(self.df)} images")
        print(f"Score range: {self.df['target_score'].min():.1f} - {self.df['target_score'].max():.1f}")
    
    def _calculate_aesthetic_scores(self):
        """Calculate weighted average aesthetic scores from vote columns."""
        vote_columns = [f'vote_{i}' for i in range(1, 11)]
        weights = np.array(range(1, 11))
        
        # Calculate weighted average (1-10 scale)
        self.df['avg_score'] = self.df[vote_columns].values @ weights
        self.df['total_votes'] = self.df[vote_columns].sum(axis=1)
    
    def _normalize_target_scores(self):
        """Normalize scores from 1-10 to target range (default 0-100)."""
        min_target, max_target = self.score_range
        
        # Normalize 1-10 range to target range
        self.df['target_score'] = (
            (self.df['avg_score'] - 1) / 9 * (max_target - min_target) + min_target
        )
    
    def _filter_existing_images(self):
        """Remove entries where image files don't exist."""
        existing_mask = []
        missing_count = 0
        
        for _, row in self.df.iterrows():
            img_path = self.images_path / f"{int(row['image_num'])}.jpg"
            exists = img_path.exists()
            existing_mask.append(exists)
            if not exists:
                missing_count += 1
        
        if missing_count > 0:
            print(f"Warning: {missing_count} image files not found")
        
        self.df = self.df[existing_mask].reset_index(drop=True)
    
    def __len__(self):
        return len(self.df)
    
    def __getitem__(self, idx):
        """
        Get a single sample from the dataset.
        
        Returns:
            tuple: (image_tensor, score_tensor, metadata_dict)
        """
        row = self.df.iloc[idx]
        
        # Load image
        img_path = self.images_path / f"{int(row['image_num'])}.jpg"
        
        try:
            image = Image.open(img_path).convert('RGB')
        except Exception as e:
            print(f"Error loading {img_path}: {e}")
            # Create a black fallback image
            image = Image.new('RGB', (224, 224), color=(0, 0, 0))
        
        # Apply transforms
        if self.transform:
            image = self.transform(image)
        
        # Get target score
        score = torch.tensor(row['target_score'], dtype=torch.float32)
        
        # Metadata for debugging/analysis
        metadata = {
            'image_id': int(row['image_num']),
            'original_score': row['avg_score'],
            'total_votes': row.get('total_votes', 0)
        }
        
        return image, score, metadata

def create_stratified_splits(csv_path, val_split=0.15, test_split=0.15, random_state=42):
    """
    Create stratified train/validation/test splits based on aesthetic scores.
    
    Args:
        csv_path (str): Path to ground truth CSV
        val_split (float): Validation split ratio
        test_split (float): Test split ratio
        random_state (int): Random seed for reproducibility
        
    Returns:
        tuple: (train_df, val_df, test_df, split_info)
    """
    # Load dataset
    df = pd.read_csv(csv_path)
    
    # Calculate aesthetic scores
    vote_columns = [f'vote_{i}' for i in range(1, 11)]
    weights = np.array(range(1, 11))
    df['avg_score'] = df[vote_columns].values @ weights
    df['total_votes'] = df[vote_columns].sum(axis=1)
    
    # Create score bins for stratification
    df['score_bin'] = pd.cut(df['avg_score'], 
                           bins=[1.0, 3.5, 4.5, 5.5, 6.5, 10.0],
                           labels=['very_low', 'low', 'medium', 'high', 'very_high'])
    
    print("Dataset loaded:")
    print(f"Total images: {len(df)}")
    print("\nScore distribution:")
    print(df['score_bin'].value_counts().sort_index())
    print(f"\nScore statistics:")
    print(f"Mean: {df['avg_score'].mean():.2f}")
    print(f"Std:  {df['avg_score'].std():.2f}")
    print(f"Range: {df['avg_score'].min():.2f} - {df['avg_score'].max():.2f}")
    
    # First split: Train vs (Val + Test)
    train_indices, temp_indices = train_test_split(
        range(len(df)),
        test_size=(val_split + test_split),
        stratify=df['score_bin'],
        random_state=random_state
    )
    
    # Second split: Val vs Test from temp
    temp_df = df.iloc[temp_indices]
    relative_test_size = test_split / (val_split + test_split)
    
    val_indices, test_indices = train_test_split(
        temp_indices,
        test_size=relative_test_size,
        stratify=temp_df['score_bin'],
        random_state=random_state
    )
    
    # Create split DataFrames
    train_df = df.iloc[train_indices].reset_index(drop=True)
    val_df = df.iloc[val_indices].reset_index(drop=True)
    test_df = df.iloc[test_indices].reset_index(drop=True)
    
    # Validate splits
    print(f"\nSplits created:")
    splits_data = []
    for name, split_df in [('Train', train_df), ('Val', val_df), ('Test', test_df)]:
        mean_score = split_df['avg_score'].mean()
        std_score = split_df['avg_score'].std()
        high_quality = (split_df['avg_score'] > 7.0).sum()
        low_quality = (split_df['avg_score'] < 4.0).sum()
        
        splits_data.append({
            'split': name,
            'size': len(split_df),
            'percentage': len(split_df) / len(df) * 100,
            'mean_score': mean_score,
            'std_score': std_score,
            'high_quality': high_quality,
            'low_quality': low_quality
        })
        
        print(f"{name:5}: {len(split_df):6,} images ({len(split_df)/len(df)*100:.1f}%), "
              f"score {mean_score:.2f}±{std_score:.2f}")
    
    # Split information
    split_info = {
        'total_images': len(df),
        'train_size': len(train_df),
        'val_size': len(val_df),
        'test_size': len(test_df),
        'val_split': val_split,
        'test_split': test_split,
        'random_state': random_state,
        'splits_data': splits_data
    }
    
    return train_df, val_df, test_df, split_info

def get_data_transforms():
    """
    Define data augmentation and normalization transforms.
    
    Returns:
        tuple: (train_transform, val_test_transform)
    """
    # Training transforms with augmentation
    train_transform = transforms.Compose([
        transforms.Resize((256, 256)),
        transforms.RandomCrop(224),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.RandomRotation(degrees=15),
        transforms.ColorJitter(
            brightness=0.2, 
            contrast=0.2, 
            saturation=0.2, 
            hue=0.1
        ),
        transforms.RandomAdjustSharpness(sharpness_factor=2, p=0.3),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],  # ImageNet stats
            std=[0.229, 0.224, 0.225]
        )
    ])
    
    # Validation/Test transforms without augmentation
    val_test_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225]
        )
    ])
    
    return train_transform, val_test_transform

def create_data_loaders(csv_path, images_path, batch_size=32, val_split=0.15, 
                       test_split=0.15, num_workers=4, random_state=42):
    """
    Create complete data loading pipeline with stratified splits.
    
    Args:
        csv_path (str): Path to ground truth CSV
        images_path (str): Path to images directory
        batch_size (int): Batch size for training
        val_split (float): Validation split ratio
        test_split (float): Test split ratio
        num_workers (int): Number of data loading workers
        random_state (int): Random seed
        
    Returns:
        tuple: (train_loader, val_loader, test_loader, split_info)
    """
    print("Creating data loaders...")
    
    # Create stratified splits
    train_df, val_df, test_df, split_info = create_stratified_splits(
        csv_path, val_split, test_split, random_state
    )
    
    # Get transforms
    train_transform, val_test_transform = get_data_transforms()
    
    # Create datasets
    train_dataset = AVAPhotographyDataset(train_df, images_path, train_transform)
    val_dataset = AVAPhotographyDataset(val_df, images_path, val_test_transform)
    test_dataset = AVAPhotographyDataset(test_df, images_path, val_test_transform)
    
    # Create data loaders
    train_loader = DataLoader(
        train_dataset,
        batch_size=batch_size,
        shuffle=True,
        num_workers=num_workers,
        pin_memory=True,
        drop_last=True  # For consistent batch sizes
    )
    
    val_loader = DataLoader(
        val_dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        pin_memory=True
    )
    
    test_loader = DataLoader(
        test_dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        pin_memory=True
    )
    
    print(f"\nData loaders created successfully!")
    print(f"Batch size: {batch_size}")
    print(f"Workers: {num_workers}")
    print(f"Train batches: {len(train_loader)}")
    print(f"Val batches: {len(val_loader)}")
    print(f"Test batches: {len(test_loader)}")
    
    return train_loader, val_loader, test_loader, split_info

# Test the dataset loader
if __name__ == "__main__":
    # Test dataset loading
    csv_path = "../datasets/ground_truth_dataset.csv"
    images_path = "../datasets/images"
    
    print("Testing dataset loader...")
    
    try:
        train_loader, val_loader, test_loader, split_info = create_data_loaders(
            csv_path, images_path, batch_size=8, num_workers=2
        )
        
        # Test loading one batch from each split
        for name, loader in [('Train', train_loader), ('Val', val_loader), ('Test', test_loader)]:
            images, scores, metadata = next(iter(loader))
            print(f"\n{name} batch test:")
            print(f"  Images shape: {images.shape}")
            print(f"  Scores shape: {scores.shape}")
            print(f"  Score range: {scores.min():.1f} - {scores.max():.1f}")
            print(f"  Sample scores: {scores[:4].tolist()}")
        
        # Save split info for reference
        with open('split_info.json', 'w') as f:
            # Convert numpy types to regular Python types for JSON serialization
            split_info_json = json.loads(json.dumps(split_info, default=str))
            json.dump(split_info_json, f, indent=2)
        
        print("\nDataset loader test successful!")
        print("Split info saved to split_info.json")
        
    except Exception as e:
        print(f"Error testing dataset: {e}")
        import traceback
        traceback.print_exc()