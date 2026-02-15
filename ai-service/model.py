import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import models
import json

class PhotographyEvaluationCNN(nn.Module):
    """
    CNN model for photography aesthetic evaluation.
    Uses pretrained backbone with custom regression head.
    """
    
    def __init__(self, backbone='resnet50', num_outputs=1, pretrained=True, 
                 dropout_rate=0.5, hidden_size=512):
        """
        Initialize the photography evaluation model.
        
        Args:
            backbone (str): Backbone architecture ('resnet50', 'mobilenet_v3', 'efficientnet_b0')
            num_outputs (int): Number of output values (1 for single aesthetic score)
            pretrained (bool): Use pretrained ImageNet weights
            dropout_rate (float): Dropout rate in head
            hidden_size (int): Hidden layer size in head
        """
        super(PhotographyEvaluationCNN, self).__init__()
        
        self.backbone_name = backbone
        self.num_outputs = num_outputs
        self.dropout_rate = dropout_rate
        
        # Initialize backbone
        self.backbone = self._create_backbone(backbone, pretrained)
        backbone_features = self._get_backbone_features(backbone)
        
        # Custom regression head
        self.head = nn.Sequential(
            nn.Dropout(dropout_rate),
            nn.Linear(backbone_features, hidden_size),
            nn.BatchNorm1d(hidden_size),
            nn.ReLU(inplace=True),
            
            nn.Dropout(dropout_rate / 2),
            nn.Linear(hidden_size, hidden_size // 2),
            nn.BatchNorm1d(hidden_size // 2),
            nn.ReLU(inplace=True),
            
            nn.Dropout(dropout_rate / 4),
            nn.Linear(hidden_size // 2, num_outputs),
            nn.Sigmoid()  # Output 0-1, will be scaled to 0-100
        )
        
        # Initialize head weights
        self._initialize_head()
        
        print(f"Model initialized:")
        print(f"  Backbone: {backbone} (pretrained: {pretrained})")
        print(f"  Features: {backbone_features}")
        print(f"  Outputs: {num_outputs}")
        print(f"  Dropout: {dropout_rate}")
    
    def _create_backbone(self, backbone, pretrained):
        """Create and configure backbone network."""
        if backbone == 'resnet50':
            model = models.resnet50(pretrained=pretrained)
            # Remove final classification layer
            model = nn.Sequential(*list(model.children())[:-1])
            
        elif backbone == 'mobilenet_v3':
            model = models.mobilenet_v3_large(pretrained=pretrained)
            # Remove classifier
            model.classifier = nn.Identity()
            
        elif backbone == 'efficientnet_b0':
            model = models.efficientnet_b0(pretrained=pretrained)
            # Remove classifier
            model.classifier = nn.Identity()
            
        else:
            raise ValueError(f"Unsupported backbone: {backbone}")
        
        return model
    
    def _get_backbone_features(self, backbone):
        """Get number of features from backbone."""
        feature_map = {
            'resnet50': 2048,
            'mobilenet_v3': 960,
            'efficientnet_b0': 1280
        }
        return feature_map[backbone]
    
    def _initialize_head(self):
        """Initialize head layer weights."""
        for module in self.head.modules():
            if isinstance(module, nn.Linear):
                nn.init.kaiming_normal_(module.weight, mode='fan_out', nonlinearity='relu')
                if module.bias is not None:
                    nn.init.constant_(module.bias, 0)
            elif isinstance(module, nn.BatchNorm1d):
                nn.init.constant_(module.weight, 1)
                nn.init.constant_(module.bias, 0)
    
    def forward(self, x):
        """
        Forward pass through the model.
        
        Args:
            x (torch.Tensor): Input images of shape (batch_size, 3, 224, 224)
            
        Returns:
            torch.Tensor: Aesthetic scores of shape (batch_size, num_outputs)
                         Values are in range 0-100
        """
        # Extract features with backbone
        features = self.backbone(x)
        
        # Flatten features if needed
        if features.dim() > 2:
            features = torch.flatten(features, 1)
        
        # Get predictions through head (0-1 range)
        predictions = self.head(features)
        
        # Scale to 0-100 range
        predictions = predictions * 100
        
        return predictions
    
    def freeze_backbone(self):
        """Freeze backbone parameters for fine-tuning."""
        for param in self.backbone.parameters():
            param.requires_grad = False
        print("Backbone frozen for fine-tuning")
    
    def unfreeze_backbone(self):
        """Unfreeze backbone parameters for full training."""
        for param in self.backbone.parameters():
            param.requires_grad = True
        print("Backbone unfrozen for full training")
    
    def get_model_info(self):
        """Get model architecture information."""
        total_params = sum(p.numel() for p in self.parameters())
        trainable_params = sum(p.numel() for p in self.parameters() if p.requires_grad)
        
        return {
            'backbone': self.backbone_name,
            'num_outputs': self.num_outputs,
            'total_parameters': total_params,
            'trainable_parameters': trainable_params,
            'frozen_backbone': trainable_params < total_params
        }

class AestheticLoss(nn.Module):
    """
    Custom loss function for aesthetic evaluation.
    Combines MSE loss with ranking loss for better aesthetic prediction.
    """
    
    def __init__(self, mse_weight=1.0, ranking_weight=0.1):
        super(AestheticLoss, self).__init__()
        self.mse_weight = mse_weight
        self.ranking_weight = ranking_weight
        self.mse_loss = nn.MSELoss()
    
    def forward(self, predictions, targets):
        """
        Calculate combined aesthetic loss.
        
        Args:
            predictions (torch.Tensor): Model predictions (batch_size,)
            targets (torch.Tensor): Ground truth scores (batch_size,)
            
        Returns:
            torch.Tensor: Combined loss value
        """
        # Primary MSE loss
        mse_loss = self.mse_loss(predictions.squeeze(), targets)
        
        # Ranking loss (encourages relative order preservation)
        ranking_loss = 0.0
        if len(predictions) > 1:
            # Calculate pairwise ranking violations
            pred_diff = predictions.unsqueeze(1) - predictions.unsqueeze(0)
            target_diff = targets.unsqueeze(1) - targets.unsqueeze(0)
            
            # Penalize cases where prediction order doesn't match target order
            ranking_violations = torch.relu(-pred_diff * target_diff)
            ranking_loss = ranking_violations.mean()
        
        # Combine losses
        total_loss = (self.mse_weight * mse_loss + 
                     self.ranking_weight * ranking_loss)
        
        return total_loss, mse_loss, ranking_loss

def create_model(backbone='resnet50', pretrained=True, device='cuda'):
    """
    Create and configure model for training.
    
    Args:
        backbone (str): Model backbone
        pretrained (bool): Use pretrained weights
        device (str): Target device
        
    Returns:
        tuple: (model, criterion, model_info)
    """
    # Create model
    model = PhotographyEvaluationCNN(
        backbone=backbone,
        pretrained=pretrained,
        dropout_rate=0.5,
        hidden_size=512
    )
    
    # Move to device
    model = model.to(device)
    
    # Create loss function
    criterion = AestheticLoss(mse_weight=1.0, ranking_weight=0.1)
    
    # Get model info
    model_info = model.get_model_info()
    
    print(f"Model created and moved to {device}")
    print(f"Total parameters: {model_info['total_parameters']:,}")
    print(f"Trainable parameters: {model_info['trainable_parameters']:,}")
    
    return model, criterion, model_info

# Test the model
if __name__ == "__main__":
    print("Testing model architecture...")
    
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")
    
    # Create model
    model, criterion, model_info = create_model(backbone='resnet50', device=device)
    
    # Test forward pass
    batch_size = 4
    dummy_input = torch.randn(batch_size, 3, 224, 224).to(device)
    dummy_target = torch.randn(batch_size) * 100  # Scores 0-100
    dummy_target = dummy_target.to(device)
    
    # Forward pass
    with torch.no_grad():
        predictions = model(dummy_input)
        loss, mse_loss, ranking_loss = criterion(predictions.squeeze(), dummy_target)
    
    print(f"\nModel test successful!")
    print(f"Input shape: {dummy_input.shape}")
    print(f"Output shape: {predictions.shape}")
    print(f"Sample predictions: {predictions.squeeze()[:4].cpu().numpy()}")
    print(f"Loss: {loss.item():.4f} (MSE: {mse_loss.item():.4f}, Ranking: {ranking_loss:.4f})")
    
    # Save model info
    with open('model_info.json', 'w') as f:
        json.dump(model_info, f, indent=2)
    
    print("Model test completed!")