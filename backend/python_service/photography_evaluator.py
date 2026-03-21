import torch
import torch.nn as nn
from torchvision import models
import torchvision.transforms as transforms
from PIL import Image
import json
import sys
import io
import base64
import os
try:
    import timm
    TIMM_AVAILABLE = True
except ImportError:
    TIMM_AVAILABLE = False

# Multi-attribute Photography Evaluation Model (matches trained architecture)
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
            print(f"✅ Loaded {backbone} with {backbone_features} features", file=sys.stderr)
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
        
        # Calculate overall score as average
        overall = (composition + color + focus + exposure) / 4
        
        return {
            'composition_score': composition,
            'color_score': color,
            'focus_score': focus,
            'exposure_score': exposure,
            'overall_score': overall
        }

class PhotographyEvaluator:
    def __init__(self, model_path):
        """Load the trained photography evaluation model."""
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        
        try:
            print(f"Loading model from: {model_path}", file=sys.stderr)
            print(f"Using device: {self.device}", file=sys.stderr)
            
            # Load checkpoint
            checkpoint = torch.load(model_path, map_location=self.device, weights_only=False)
            print(f"Checkpoint keys: {list(checkpoint.keys())}", file=sys.stderr)
            
            # Detect backbone from checkpoint config or state dict
            backbone = 'resnet50'  # default
            if 'config' in checkpoint and 'backbone' in checkpoint['config']:
                backbone = checkpoint['config']['backbone']
                print(f"Detected backbone from config: {backbone}", file=sys.stderr)
            else:
                # Try to detect from state dict keys
                state_dict_keys = checkpoint.get('model_state_dict', checkpoint).keys()
                if any('vit' in str(k).lower() or 'blocks' in str(k) for k in state_dict_keys):
                    backbone = os.environ.get('MODEL_BACKBONE', 'vit_small_patch16_224')
                    print(f"Detected ViT architecture from state dict, using: {backbone}", file=sys.stderr)
            
            print(f"Creating model with backbone: {backbone}", file=sys.stderr)
            
            # Create model with matching architecture
            self.model = PhotographyEvaluationModel(
                backbone=backbone,
                pretrained=False,  # Don't load pretrained weights
                dropout_rate=0.5
            )
            self.model = self.model.to(self.device)
            
            # Load trained weights
            if 'model_state_dict' in checkpoint:
                state_dict = checkpoint['model_state_dict']
            else:
                state_dict = checkpoint
            
            print(f"State dict keys (first 10): {list(state_dict.keys())[:10]}", file=sys.stderr)
            
            # Load with strict=True (should match exactly)
            self.model.load_state_dict(state_dict, strict=True)
            
            self.model.eval()
            print("✅ Model loaded successfully!", file=sys.stderr)
            
            # Print model info
            total_params = sum(p.numel() for p in self.model.parameters())
            print(f"Model parameters: {total_params:,}", file=sys.stderr)
            
            # Image preprocessing (same as training)
            self.transform = transforms.Compose([
                transforms.Resize((224, 224)),
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.485, 0.456, 0.406], 
                                   std=[0.229, 0.224, 0.225])
            ])
        except Exception as e:
            error_msg = f"Failed to load model: {str(e)}"
            print(error_msg, file=sys.stderr)
            raise Exception(error_msg)
    
    
    def evaluate_image(self, image_buffer):
        """Evaluate photography aesthetics from image buffer."""
        try:
            # Load image
            image = Image.open(io.BytesIO(image_buffer))
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            print(f"Image loaded: {image.size}", file=sys.stderr)
            
            # Preprocess
            input_tensor = self.transform(image).unsqueeze(0).to(self.device)
            print(f"Input tensor shape: {input_tensor.shape}", file=sys.stderr)

            # Predict
            with torch.no_grad():
                predictions = self.model(input_tensor)
            
            # Extract scores (already clamped to 0-100 in model)
            composition_score = predictions['composition_score'].item()
            color_score = predictions['color_score'].item()
            focus_score = predictions['focus_score'].item()
            exposure_score = predictions['exposure_score'].item()
            overall_score = predictions['overall_score'].item()
            
            print(f"Predicted scores:", file=sys.stderr)
            print(f"  Composition: {composition_score:.1f}", file=sys.stderr)
            print(f"  Color: {color_score:.1f}", file=sys.stderr)
            print(f"  Focus: {focus_score:.1f}", file=sys.stderr)
            print(f"  Exposure: {exposure_score:.1f}", file=sys.stderr)
            print(f"  Overall: {overall_score:.1f}", file=sys.stderr)
            
            result = {
                'composition_score': round(composition_score, 1),
                'color_score': round(color_score, 1),
                'focus_score': round(focus_score, 1),
                'exposure_score': round(exposure_score, 1),
                'overall_score': round(overall_score, 1)
            }
            
            return result
            
        except Exception as e:
            error_msg = f"Image evaluation error: {str(e)}"
            print(error_msg, file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)
            return {
                'error': error_msg,
                'composition_score': 50,
                'color_score': 50,
                'focus_score': 50,
                'exposure_score': 50,
                'overall_score': 50
            }

def main():
    """CLI interface for Node.js integration."""
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No image data provided'}))
        return
    
    try:
        # Get image file path from command line (instead of base64)
        image_path_arg = sys.argv[1]
        
        print(f"Processing image argument: {image_path_arg}", file=sys.stderr)
        
        # Check if it looks like a file path (has common image extension)
        is_file_path = any(image_path_arg.lower().endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.bmp', '.gif'])
        
        if is_file_path:
            # It's a file path - make it absolute and read
            if not os.path.isabs(image_path_arg):
                # Relative path - make it absolute from script directory
                script_dir = os.path.dirname(os.path.abspath(__file__))
                image_path = os.path.normpath(os.path.join(script_dir, image_path_arg))
            else:
                image_path = image_path_arg
            
            print(f"Reading image file: {image_path}", file=sys.stderr)
            
            if not os.path.exists(image_path):
                raise Exception(f"Image file not found: {image_path}")
            
            with open(image_path, 'rb') as f:
                image_buffer = f.read()
            print(f"✅ Read image from file: {len(image_buffer)} bytes", file=sys.stderr)
        else:
            # Assume it's base64 data
            print(f"Decoding base64 image data", file=sys.stderr)
            image_buffer = base64.b64decode(image_path_arg)
            print(f"✅ Decoded base64 image: {len(image_buffer)} bytes", file=sys.stderr)
        
        # Get model path from environment or use default
        model_path = os.environ.get('CUSTOM_MODEL_PATH', 
                                   '../../ai-service/outputs/cnn_multi_attr_3/best_model.pth')
        
        # Make path absolute
        if not os.path.isabs(model_path):
            model_path = os.path.join(os.path.dirname(__file__), model_path)
        
        print(f"Using model path: {model_path}", file=sys.stderr)
        
        # Check if model file exists
        if not os.path.exists(model_path):
            raise Exception(f"Model file not found: {model_path}")
        
        # Load model and evaluate
        evaluator = PhotographyEvaluator(model_path)
        result = evaluator.evaluate_image(image_buffer)
        
        # Output JSON for Node.js
        print(json.dumps(result))
        
    except Exception as e:
        error_msg = f"Main execution error: {str(e)}"
        print(error_msg, file=sys.stderr)
        print(json.dumps({'error': error_msg}))

if __name__ == '__main__':
    main()