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

class AADBPhotographyDataset(Dataset):
    """
    AADB Dataset loader for photography aesthetic evaluation.
    Provides attribute-level scores: composition, color, focus, exposure.
    """
    
    def __init__(self, df, images_path, transform=None):
        """
        Initialize dataset with pre-split DataFrame.
        
        Args:
            df (pandas.DataFrame): DataFrame with AADB labels
            images_path (str): Path to AADB images directory
            transform (torchvision.transforms): Image transformations
        """
        self.df = df.copy()
        self.images_path = Path(images_path)
        self.transform = transform
        
        # AADB provides scores in 0-1 range, scale to 0-100
        self._normalize_scores()
        
        # Filter out missing images
        self._filter_existing_images()
        
        print(f"Dataset initialized: {len(self.df)} images")
        if len(self.df) > 0:
            print(f"Score ranges:")
            print(f"  Composition: {self.df['composition_score'].min():.1f} - {self.df['composition_score'].max():.1f}")
            print(f"  Color: {self.df['color_score'].min():.1f} - {self.df['color_score'].max():.1f}")
            print(f"  Focus: {self.df['focus_score'].min():.1f} - {self.df['focus_score'].max():.1f}")
            print(f"  Exposure: {self.df['exposure_score'].min():.1f} - {self.df['exposure_score'].max():.1f}")
    
    def _normalize_scores(self):
        """Normalize AADB scores from their mean-centered range to 0-100 range."""
        # AADB attribute columns (case-sensitive)
        # AADB provides mean-centered scores (roughly -1 to 1)
        # We normalize to 0-100 range: (score + 1) * 50
        attribute_mapping = {
            'Composition': 'composition_score',
            'ColorHarmony': 'color_score',
            'DoF': 'focus_score',  # Depth of Field = Focus
            'Light': 'exposure_score'  # Light = Exposure
        }
        
        for aadb_col, our_col in attribute_mapping.items():
            if aadb_col in self.df.columns:
                # Convert from mean-centered (-1 to 1) to 0-100 scale
                # Clip to reasonable range first
                scores = self.df[aadb_col].clip(-1.0, 1.0)
                self.df[our_col] = (scores + 1.0) * 50.0
            else:
                print(f"Warning: Column '{aadb_col}' not found in dataset")
                self.df[our_col] = 50.0  # Default to middle score
        
        # Calculate overall score as average of 4 attributes
        score_cols = ['composition_score', 'color_score', 'focus_score', 'exposure_score']
        available_cols = [col for col in score_cols if col in self.df.columns]
        if available_cols:
            self.df['overall_score'] = self.df[available_cols].mean(axis=1)
        else:
            print("Warning: No score columns found, using default")
            self.df['overall_score'] = 50.0
    
    def _filter_existing_images(self):
        """Remove entries where image files don't exist."""
        existing_mask = []
        missing_count = 0
        
        for _, row in self.df.iterrows():
            # AADB image_id already includes extension
            img_path = self.images_path / row['image_id']
            img_found = img_path.exists()
            
            # If not found, try with different extensions (for compatibility)
            if not img_found:
                base_name = row['image_id'].rsplit('.', 1)[0]  # Remove extension if present
                for ext in ['.jpg', '.JPG', '.jpeg', '.JPEG', '.png', '.PNG']:
                    img_path_alt = self.images_path / f"{base_name}{ext}"
                    if img_path_alt.exists():
                        img_found = True
                        break
            
            existing_mask.append(img_found)
            if not img_found:
                missing_count += 1
        
        if missing_count > 0:
            print(f"Warning: {missing_count} image files not found")
        
        self.df = self.df[existing_mask].reset_index(drop=True)
    
    def __len__(self):
        """Return dataset size."""
        return len(self.df)
    
    def __getitem__(self, idx):
        """
        Get a single sample from the dataset.
        
        Returns:
            tuple: (image_tensor, scores_dict, metadata_dict)
        """
        row = self.df.iloc[idx]
        
        # Load image (image_id already includes extension from AADB labels)
        img_path = self.images_path / row['image_id']
        
        # If not found with image_id as-is, try without extension and different extensions
        if not img_path.exists():
            base_name = row['image_id'].rsplit('.', 1)[0]
            for ext in ['.jpg', '.JPG', '.jpeg', '.JPEG', '.png', '.PNG']:
                test_path = self.images_path / f"{base_name}{ext}"
                if test_path.exists():
                    img_path = test_path
                    break
        
        try:
            image = Image.open(img_path).convert('RGB')
        except Exception as e:
            print(f"Error loading {img_path}: {e}")
            # Create black fallback image
            image = Image.new('RGB', (224, 224), color=(0, 0, 0))
        
        # Apply transforms
        if self.transform:
            image = self.transform(image)
        
        # Get all attribute scores as dict
        scores = {
            'composition_score': torch.tensor(row['composition_score'], dtype=torch.float32),
            'color_score': torch.tensor(row['color_score'], dtype=torch.float32),
            'focus_score': torch.tensor(row['focus_score'], dtype=torch.float32),
            'exposure_score': torch.tensor(row['exposure_score'], dtype=torch.float32),
            'overall_score': torch.tensor(row['overall_score'], dtype=torch.float32)
        }
        
        # Metadata for debugging
        metadata = {
            'image_id': row['image_id']
        }
        
        return image, scores, metadata


def load_aadb_labels(labels_file):
    """
    Load AADB labels from text file.
    
    AADB format (space-separated):
    image_id Composition ColorHarmony Content DoF Light Object
    
    We only use: Composition, ColorHarmony, DoF, Light
    
    Args:
        labels_file: Path to AADB label file (train_labels.txt or test_labels.txt)
    
    Returns:
        pandas.DataFrame with columns: image_id, Composition, ColorHarmony, DoF, Light
    """
    data = []
    
    with open(labels_file, 'r') as f:
        for line in f:
            parts = line.strip().split()
            if len(parts) >= 7:  # image_id + 6 attributes
                data.append({
                    'image_id': parts[0],
                    'Composition': float(parts[1]),  # Composition
                    'ColorHarmony': float(parts[2]),  # Color
                    'Content': float(parts[3]),  # Not used in our model
                    'DoF': float(parts[4]),  # Focus (Depth of Field)
                    'Light': float(parts[5]),  # Exposure
                    'Object': float(parts[6])  # Not used in our model
                })
    
    df = pd.DataFrame(data)
    print(f"Loaded {len(df)} samples from {Path(labels_file).name}")
    return df


def create_data_loaders(train_labels_path, test_labels_path, images_path, 
                       batch_size=16, num_workers=4, val_split=0.15):
    """
    Create train/val/test data loaders for AADB dataset.
    
    Args:
        train_labels_path: Path to AADB train_labels.txt
        test_labels_path: Path to AADB test_labels.txt
        images_path: Path to AADB images folder
        batch_size: Batch size for training
        num_workers: Number of data loading workers
        val_split: Fraction of train set to use for validation
    
    Returns:
        tuple: (train_loader, val_loader, test_loader, split_info)
    """
    print("Loading AADB dataset...")
    
    # Load labels
    train_df = load_aadb_labels(train_labels_path)
    test_df = load_aadb_labels(test_labels_path)
    
    # Split train into train/val
    train_indices, val_indices = train_test_split(
        range(len(train_df)),
        test_size=val_split,
        random_state=42
    )
    
    train_df_split = train_df.iloc[train_indices].reset_index(drop=True)
    val_df_split = train_df.iloc[val_indices].reset_index(drop=True)
    
    print(f"\nDataset splits:")
    print(f"  Train: {len(train_df_split)} images")
    print(f"  Val:   {len(val_df_split)} images")
    print(f"  Test:  {len(test_df)} images")
    
    # Define transforms
    train_transform = transforms.Compose([
        transforms.Resize((256, 256)),
        transforms.RandomCrop(224),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.RandomRotation(degrees=15),
        transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2, hue=0.1),
        transforms.RandomAffine(degrees=0, translate=(0.1, 0.1)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])
    
    val_test_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])
    
    # Create datasets
    train_dataset = AADBPhotographyDataset(train_df_split, images_path, train_transform)
    val_dataset = AADBPhotographyDataset(val_df_split, images_path, val_test_transform)
    test_dataset = AADBPhotographyDataset(test_df, images_path, val_test_transform)
    
    # Create data loaders
    train_loader = DataLoader(
        train_dataset,
        batch_size=batch_size,
        shuffle=True,
        num_workers=num_workers,
        pin_memory=True,
        drop_last=True
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
    
    split_info = {
        'train_size': len(train_dataset),
        'val_size': len(val_dataset),
        'test_size': len(test_dataset),
        'batch_size': batch_size,
        'num_workers': num_workers
    }
    
    print(f"\nData loaders created successfully!")
    print(f"  Train batches: {len(train_loader)}")
    print(f"  Val batches: {len(val_loader)}")
    print(f"  Test batches: {len(test_loader)}")
    
    return train_loader, val_loader, test_loader, split_info


# Test the dataset
if __name__ == "__main__":
    # Test paths (update these to your actual paths)
    train_labels = "../datasets/AADB/imgListFiles_label/aesthetics_image_lists/train_labels.txt"
    test_labels = "../datasets/AADB/imgListFiles_label/aesthetics_image_lists/test_labels.txt"
    images_path = "../datasets/AADB/datasetImages_originalSize"
    
    print("Testing AADB dataset loader...")
    
    try:
        train_loader, val_loader, test_loader, split_info = create_data_loaders(
            train_labels, test_labels, images_path, batch_size=4, num_workers=0
        )
        
        # Test loading one batch
        images, scores, metadata = next(iter(train_loader))
        print(f"\n✅ Batch test successful!")
        print(f"  Images shape: {images.shape}")
        print(f"  Composition scores: {scores['composition_score'][:2].tolist()}")
        print(f"  Color scores: {scores['color_score'][:2].tolist()}")
        print(f"  Focus scores: {scores['focus_score'][:2].tolist()}")
        print(f"  Exposure scores: {scores['exposure_score'][:2].tolist()}")
        print(f"  Overall scores: {scores['overall_score'][:2].tolist()}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()