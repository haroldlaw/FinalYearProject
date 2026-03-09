import torch
import torch.nn as nn
from torchvision import models
import json
try:
    import timm
    TIMM_AVAILABLE = True
except ImportError:
    TIMM_AVAILABLE = False

class PhotographyEvaluationModel(nn.Module):
    """
    Multi-attribute photography evaluation model.
    Predicts: composition, color, focus, exposure, overall scores.
    Supports CNN (ResNet, EfficientNet) and Transformer (ViT) backbones.
    """
    
    def __init__(self, backbone='resnet50', pretrained=True, dropout_rate=0.5):
        super().__init__()
        
        self.backbone_name = backbone
        
        # Backbone selection (CNN or Transformer)
        if backbone == 'resnet50':
            self.backbone = models.resnet50(pretrained=pretrained)
            self.backbone.fc = nn.Identity()
            backbone_features = 2048
        elif backbone == 'resnet34':
            self.backbone = models.resnet34(pretrained=pretrained)
            self.backbone.fc = nn.Identity()
            backbone_features = 512
        elif backbone == 'resnet18':
            self.backbone = models.resnet18(pretrained=pretrained)
            self.backbone.fc = nn.Identity()
            backbone_features = 512
        elif backbone == 'efficientnet_b0':
            self.backbone = models.efficientnet_b0(pretrained=pretrained)
            self.backbone.classifier = nn.Identity()
            backbone_features = 1280
        elif backbone.startswith('vit_'):
            # Vision Transformer models
            if not TIMM_AVAILABLE:
                raise ImportError("timm library required for ViT models. Install with: pip install timm")
            
            self.backbone = timm.create_model(backbone, pretrained=pretrained, num_classes=0)
            backbone_features = self.backbone.num_features
            print(f"✅ Loaded {backbone} with {backbone_features} features")
        else:
            raise ValueError(f"Unsupported backbone: {backbone}. Use: resnet18, resnet34, resnet50, efficientnet_b0, vit_tiny_patch16_224, vit_small_patch16_224, vit_base_patch16_224")
        
        # Separate head for each attribute
        self.composition_head = self._make_attribute_head(backbone_features, dropout_rate)
        self.color_head = self._make_attribute_head(backbone_features, dropout_rate)
        self.focus_head = self._make_attribute_head(backbone_features, dropout_rate)
        self.exposure_head = self._make_attribute_head(backbone_features, dropout_rate)
    
    def _make_attribute_head(self, input_features, dropout_rate):
        """Create a regression head for one attribute."""
        return nn.Sequential(
            nn.Dropout(dropout_rate),
            nn.Linear(input_features, 512),
            nn.BatchNorm1d(512),
            nn.ReLU(inplace=True),
            
            nn.Dropout(dropout_rate / 2),
            nn.Linear(512, 256),
            nn.BatchNorm1d(256),
            nn.ReLU(inplace=True),
            
            nn.Dropout(dropout_rate / 4),
            nn.Linear(256, 1)
        )
    
    def forward(self, x):
        """
        Forward pass.
        
        Args:
            x: Input images (batch, 3, 224, 224)
        
        Returns:
            dict: {
                'composition_score': tensor,
                'color_score': tensor,
                'focus_score': tensor,
                'exposure_score': tensor,
                'overall_score': tensor
            }
        """
        # Extract features
        features = self.backbone(x)
        if features.dim() > 2:
            features = torch.flatten(features, 1)
        
        # Get predictions for each attribute (clamp to 0-100)
        composition = torch.clamp(self.composition_head(features), 0, 100)
        color = torch.clamp(self.color_head(features), 0, 100)
        focus = torch.clamp(self.focus_head(features), 0, 100)
        exposure = torch.clamp(self.exposure_head(features), 0, 100)
        
        # Calculate overall as average
        overall = (composition + color + focus + exposure) / 4
        
        return {
            'composition_score': composition.squeeze(),
            'color_score': color.squeeze(),
            'focus_score': focus.squeeze(),
            'exposure_score': exposure.squeeze(),
            'overall_score': overall.squeeze()
        }
    
    def get_model_info(self):
        """Get model architecture information."""
        total_params = sum(p.numel() for p in self.parameters())
        trainable_params = sum(p.numel() for p in self.parameters() if p.requires_grad)
        
        return {
            'backbone': self.backbone_name,
            'total_parameters': total_params,
            'trainable_parameters': trainable_params
        }


class MultiAttributeLoss(nn.Module):
    """Loss function for multi-attribute prediction."""
    
    def __init__(self, weights=None):
        super().__init__()
        # Equal weights for all attributes by default
        self.weights = weights or {
            'composition': 1.0,
            'color': 1.0,
            'focus': 1.0,
            'exposure': 1.0,
            'overall': 0.5  # Lower weight since it's derived
        }
        self.mse = nn.MSELoss()
    
    def forward(self, predictions, targets):
        """
        Calculate loss.
        
        Args:
            predictions: dict with keys: composition_score, color_score, etc.
            targets: dict with same keys
        
        Returns:
            tuple: (total_loss, individual_losses_dict)
        """
        total_loss = 0
        losses = {}
        
        for attr in ['composition', 'color', 'focus', 'exposure', 'overall']:
            attr_key = f'{attr}_score'
            loss = self.mse(predictions[attr_key], targets[attr_key])
            losses[attr_key] = loss.item()
            total_loss += self.weights[attr] * loss
        
        return total_loss, losses


def create_model(backbone='resnet50', pretrained=True, device='cpu'):
    """
    Create model for training.
    
    Returns:
        tuple: (model, criterion, model_info)
    """
    model = PhotographyEvaluationModel(
        backbone=backbone,
        pretrained=pretrained,
        dropout_rate=0.5
    )
    
    model = model.to(device)
    criterion = MultiAttributeLoss()
    model_info = model.get_model_info()
    
    print(f"Model created:")
    print(f"  Backbone: {backbone}")
    print(f"  Total parameters: {model_info['total_parameters']:,}")
    print(f"  Trainable parameters: {model_info['trainable_parameters']:,}")
    print(f"  Device: {device}")
    
    return model, criterion, model_info


# Test the model
if __name__ == "__main__":
    print("Testing model architecture...")
    
    device = torch.device('mps' if torch.backends.mps.is_available() else 'cpu')
    model, criterion, info = create_model(backbone='resnet50', device=device)
    
    # Test forward pass
    dummy_input = torch.randn(4, 3, 224, 224).to(device)
    output = model(dummy_input)
    
    print(f"\n✅ Model test successful!")
    print(f"  Input shape: {dummy_input.shape}")
    print(f"  Output keys: {list(output.keys())}")
    print(f"  Composition scores shape: {output['composition_score'].shape}")
    print(f"  Sample output: composition={output['composition_score'][0].item():.2f}, "
          f"color={output['color_score'][0].item():.2f}")