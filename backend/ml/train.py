"""
Pothole and Road Damage Detection System - ML Training Module
This script fine-tunes a base YOLOv8 model on a custom dataset in YOLO format.
"""

import argparse
import logging
from pathlib import Path
from ultralytics import YOLO

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("pothole_detector.train")

def train_model(data_yaml: str, epochs: int, batch_size: int, img_size: int, base_model: str, output_dir: str):
    """
    Fine-tune YOLOv8 on a custom road damage dataset.
    
    Args:
        data_yaml: Path to the dataset configuration YAML file.
        epochs: Number of training epochs.
        batch_size: Training batch size (-1 for auto-batch).
        img_size: Input image width/height (typically 640).
        base_model: Base weights to start training from (e.g. 'yolov8n.pt').
        output_dir: Folder to save runs and weights.
    """
    logger.info(f"Starting fine-tuning with base model: {base_model}")
    logger.info(f"Dataset configuration: {data_yaml}")
    logger.info(f"Training parameters: epochs={epochs}, batch={batch_size}, imgsz={img_size}")
    
    # Check if dataset yaml exists
    data_path = Path(data_yaml)
    if not data_path.exists():
        logger.error(f"Dataset configuration YAML not found at {data_yaml}")
        return
        
    try:
        # Load base model
        model = YOLO(base_model)
        
        # Execute training
        results = model.train(
            data=str(data_path),
            epochs=epochs,
            batch=batch_size,
            imgsz=img_size,
            project=output_dir,
            name="road_damage_model",
            device=0, # Use GPU 0 by default if available, otherwise it falls back to CPU
            exist_ok=True
        )
        
        logger.info("Training completed successfully.")
        logger.info(f"Model runs saved to: {output_dir}/road_damage_model")
        
    except Exception as e:
        logger.exception(f"An error occurred during training: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fine-tune YOLOv8 on road damage datasets.")
    parser.add_argument("--data", type=str, required=True, help="Path to data.yaml dataset config")
    parser.add_argument("--epochs", type=int, default=50, help="Number of training epochs")
    parser.add_argument("--batch", type=int, default=16, help="Batch size (-1 for auto)")
    parser.add_argument("--imgsz", type=int, default=640, help="Input image size")
    parser.add_argument("--base", type=str, default="yolov8n.pt", help="Base model weights (e.g., yolov8n.pt, yolov8s.pt)")
    parser.add_argument("--out", type=str, default="backend/ml/runs", help="Directory to save training runs")
    
    args = parser.parse_args()
    
    train_model(
        data_yaml=args.data,
        epochs=args.epochs,
        batch_size=args.batch,
        img_size=args.imgsz,
        base_model=args.base,
        output_dir=args.out
    )
