"""Script to train all prediction models"""
import sys
from pathlib import Path
backend_dir = Path(__file__).parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from enhanced_predictions import EnhancedPredictor
from ml_models import MultiModelPredictor

def train_all_models():
    """Train all prediction models"""
    print("=" * 80)
    print("TRAINING ALL PREDICTION MODELS")
    print("=" * 80)
    
    # Train standard models
    print("\n" + "=" * 80)
    print("1. TRAINING STANDARD MODELS (Random Forest, Gradient Boosting, Neural Network)")
    print("=" * 80)
    try:
        standard_predictor = MultiModelPredictor()
        standard_results = standard_predictor.train_all_models(use_grid_search=False)
        print("\nStandard Models Training Results:")
        for model_name, metrics in standard_results.items():
            print(f"  {model_name}: R²={metrics['r2']:.4f}, RMSE={metrics['rmse']:.2f}, MAE={metrics['mae']:.2f}")
    except Exception as e:
        print(f"Error training standard models: {e}")
        import traceback
        traceback.print_exc()
    
    # Train enhanced models
    print("\n" + "=" * 80)
    print("2. TRAINING ENHANCED MODELS (Tuition-Attendance, Enrollment, etc.)")
    print("=" * 80)
    try:
        enhanced_predictor = EnhancedPredictor()
        enhanced_results = enhanced_predictor.train_all_models()
        print("\nEnhanced Models Training Results:")
        for model_name, metrics in enhanced_results.items():
            print(f"  {model_name}: {metrics}")
    except Exception as e:
        print(f"Error training enhanced models: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "=" * 80)
    print("TRAINING COMPLETE!")
    print("=" * 80)
    print("\nYou can now use the prediction endpoints:")
    print("  - /api/predictions/predict (standard models)")
    print("  - /api/predictions/tuition-attendance-performance (tuition+attendance model)")
    print("  - /api/predictions/scenario (scenario analysis)")

if __name__ == "__main__":
    train_all_models()

