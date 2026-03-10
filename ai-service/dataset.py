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
        # AADB provides mean-centered scores (roughly -1 to 1)
        # We normalize to 0-100 range: (score + 1) * 50
        
        # Multi-attribute fusion with Top-2 averaging for composition
        attribute_groups = {
            'composition_score': ['RuleOfThirds', 'Symmetry', 'BalacingElements', 'Repetition', 'Object'],
            'color_score': ['ColorHarmony', 'VividColor'],
            'focus_score': ['DoF'],
            'exposure_score': ['Light']
        }
        
        # Normalize and group attributes
        for our_col, aadb_cols in attribute_groups.items():
            normalized_attrs = []
            
            for aadb_col in aadb_cols:
                if aadb_col in self.df.columns:
                    # Convert from mean-centered (-1 to 1) to 0-100 scale
                    scores = self.df[aadb_col].clip(-1.0, 1.0)
                    normalized = (scores + 1.0) * 50.0
                    normalized_attrs.append(normalized)
                else:
                    print(f"Warning: Column '{aadb_col}' not found in dataset")
            
            # Special handling for composition: Take Top-2 average
            # Philosophy: Good composition = 2-3 techniques executed well
            if normalized_attrs:
                if our_col == 'composition_score' and len(normalized_attrs) >= 2:
                    # Take average of top 2 attributes for each image
                    attrs_df = pd.concat(normalized_attrs, axis=1)
                    # Sort each row and take mean of top 2 values
                    self.df[our_col] = attrs_df.apply(
                        lambda row: row.nlargest(2).mean(), axis=1
                    )
                    print(f"  {our_col}: top-2 average of {len(normalized_attrs)} attributes")
                else:
                    # Regular average for color, focus, exposure
                    self.df[our_col] = pd.concat(normalized_attrs, axis=1).mean(axis=1)
                    print(f"  {our_col}: averaged {len(normalized_attrs)} attributes")
            else:
                print(f"Warning: No attributes found for {our_col}, using default")
                self.df[our_col] = 50.0
        
        # Calculate overall score as average of 4 technical scores
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


def load_aadb_attribute_file(file_path):
    """Load single AADB attribute file (image_id score pairs)."""
    data = {}
    with open(file_path, 'r') as f:
        for line in f:
            parts = line.strip().split()
            if len(parts) == 2:
                image_id, score = parts[0], float(parts[1])
                data[image_id] = score
    return data


def load_aadb_labels_from_individual_files(labels_base_path, split='Train'):
    """
    Load all 11 AADB attributes from individual regression files.
    
    Args:
        labels_base_path: Path to AADB imgListFiles_label directory
        split: 'Train', 'Test', or 'Validation'
    
    Returns:
        pandas.DataFrame with all 11 AADB attributes
    """
    labels_base_path = Path(labels_base_path)
    
    # All 11 AADB attributes
    attribute_names = [
        'RuleOfThirds', 'Symmetry', 'BalacingElements', 'Repetition', 'Object',
        'ColorHarmony', 'VividColor', 'DoF', 'Light', 'Content', 'MotionBlur'
    ]
    
    # Load each attribute from its file
    all_attributes = {}
    for attr in attribute_names:
        file_name = f'imgList{split}Regression_{attr}.txt'
        file_path = labels_base_path / file_name
        
        if file_path.exists():
            attr_data = load_aadb_attribute_file(file_path)
            all_attributes[attr] = attr_data
            print(f"  Loaded {attr}: {len(attr_data)} images")
        else:
            print(f"  Warning: {file_name} not found")
    
    # Get all unique image IDs
    all_image_ids = set()
    for attr_data in all_attributes.values():
        all_image_ids.update(attr_data.keys())
    
    # Build DataFrame with all attributes
    data = []
    for image_id in sorted(all_image_ids):
        row = {'image_id': image_id}
        for attr, attr_data in all_attributes.items():
            row[attr] = attr_data.get(image_id, 0.0)  # Default to 0 if missing
        data.append(row)
    
    df = pd.DataFrame(data)
    print(f"Combined dataset: {len(df)} images with {len(all_attributes)} attributes")
    return df


def load_aadb_labels(labels_file):
    """
    DEPRECATED: Old single-file loader. Use load_aadb_labels_from_individual_files instead.
    Kept for backward compatibility.
    """
    data = []
    
    with open(labels_file, 'r') as f:
        for line in f:
            parts = line.strip().split()
            if len(parts) >= 7:  # image_id + 6 attributes
                data.append({
                    'image_id': parts[0],
                    'Composition': float(parts[1]),
                    'ColorHarmony': float(parts[2]),
                    'Content': float(parts[3]),
                    'DoF': float(parts[4]),
                    'Light': float(parts[5]),
                    'Object': float(parts[6])
                })
    
    df = pd.DataFrame(data)
    print(f"Loaded {len(df)} samples from {Path(labels_file).name}")
    return df


def create_data_loaders(train_labels_path, test_labels_path, images_path, 
                       batch_size=16, num_workers=4, val_split=0.15):
    """
    Create train/val/test data loaders for AADB dataset.
    
    Args:
        train_labels_path: Path to AADB train labels (can be file or imgListFiles_label dir)
        test_labels_path: Path to AADB test labels (can be file or imgListFiles_label dir)
        images_path: Path to AADB images folder
        batch_size: Batch size for training
        num_workers: Number of data loading workers
        val_split: Fraction of train set to use for validation
    
    Returns:
        tuple: (train_loader, val_loader, test_loader, split_info)
    """
    print("Loading AADB dataset...")
    
    # Check if we're using individual files (new method) or combined file (old method)
    train_path = Path(train_labels_path)
    
    # If train_labels_path ends with .txt, use old loader; otherwise use new multi-attribute loader
    if train_path.suffix == '.txt':
        # Old method: combined label files (6 attributes only)
        print("Using combined label files (limited attributes)...")
        train_df = load_aadb_labels(train_labels_path)
        test_df = load_aadb_labels(test_labels_path)
    else:
        # New method: individual attribute files (all 11 attributes)
        print("Loading all 11 attributes from individual files...")
        print("\nTrain split:")
        train_df = load_aadb_labels_from_individual_files(train_labels_path, split='Train')
        print("\nTest split:")
        test_df = load_aadb_labels_from_individual_files(test_labels_path, split='Test')
    
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