"""
PyTorch Terrain Classifier
Entorno Conda: tfm (conda activate tfm)
Dataset: Soil Environment Analysis Dataset (Kaggle)
URL: https://www.kaggle.com/datasets/shuvokumarbasak2030/soil-environment-analysis-dataset?resource=download

Categorías de Suelo (5 clases):
1. coal_soil: Suelo en entornos con presencia dominante de carbón.
2. drought_soil: Suelo en entornos afectados por condiciones de sequía.
3. normal_soil: Suelo en condiciones ambientales típicas y sin estrés hídrico/térmico.
4. sandy_soil: Suelo arenoso con baja retención de humedad y alta permeabilidad.
5. soil_insects_soil: Suelo afectado por presencia de insectos/plagas subterráneas.

Comandos rápidos:
- Entrenar con división por grupos de hash (Cero Data Leakage):
  python main.py --mode train --epochs 10 --batch-size 32 --split-strategy hash_grouped

- Entrenar únicamente con imágenes deduplicadas únicas (53 fotos reales):
  python main.py --mode train --epochs 15 --batch-size 16 --split-strategy unique_only --freeze-backbone

- Inferencia sobre una imagen:
  python main.py --mode predict --image datasets/soil/drought_soil/10.jpg

- Evaluar modelo guardado:
  python main.py --mode test
"""

import os
import sys
import argparse
import random
import hashlib
from collections import defaultdict
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from PIL import Image
from tqdm import tqdm

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset
from torchvision import transforms, models

# Metadata contextual de las 5 categorías
SOIL_CLASSES_INFO = {
    "coal_soil": {
        "id": 0,
        "description": "Represents soil in coal-dominant environments.",
        "es_desc": "Suelo en entornos dominados por carbón mineral."
    },
    "drought_soil": {
        "id": 1,
        "description": "Represents soil in drought-affected environments.",
        "es_desc": "Suelo en entornos afectados por condiciones de sequía severa."
    },
    "normal_soil": {
        "id": 2,
        "description": "Represents soil in typical, non-stressed environmental conditions.",
        "es_desc": "Suelo en condiciones ambientales óptimas y sin estrés."
    },
    "sandy_soil": {
        "id": 3,
        "description": "Represents soil in sandy terrain, often characterized by low moisture retention.",
        "es_desc": "Suelo arenoso con baja retención de humedad y alta permeabilidad."
    },
    "soil_insects_soil": {
        "id": 4,
        "description": "Represents soil conditions affected by the presence of insects, potentially impacting soil quality and structure.",
        "es_desc": "Suelo afectado por la presencia de insectos o plagas subterráneas."
    }
}

def set_seed(seed=42):
    """Fija la semilla para reproducibilidad experimental."""
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)

def get_device():
    """Detecta automáticamente el acelerador (MPS para Apple Silicon, CUDA para Nvidia, CPU)."""
    if torch.backends.mps.is_available():
        return torch.device("mps")
    elif torch.cuda.is_available():
        return torch.device("cuda")
    else:
        return torch.device("cpu")

class PathDataset(Dataset):
    """Dataset personalizado que carga imágenes directamente desde rutas con una transformación dada."""
    def __init__(self, samples, transform=None):
        self.samples = samples  # Lista de tuplas: (ruta_imagen, etiqueta_int)
        self.transform = transform

    def __getitem__(self, index):
        path, label = self.samples[index]
        image = Image.open(path).convert('RGB')
        if self.transform:
            image = self.transform(image)
        return image, label

    def __len__(self):
        return len(self.samples)

def build_transforms():
    """Define las transformaciones y técnicas de aumento de datos."""
    mean = [0.485, 0.456, 0.406]
    std = [0.229, 0.224, 0.225]

    train_transforms = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.RandomVerticalFlip(p=0.5),
        transforms.RandomRotation(degrees=20),
        transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2),
        transforms.ToTensor(),
        transforms.Normalize(mean=mean, std=std)
    ])

    val_test_transforms = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=mean, std=std)
    ])

    return train_transforms, val_test_transforms

def analyze_dataset_duplicates(data_dir):
    """
    Inspecciona el dataset para identificar réplicas exactas mediante hash MD5.
    """
    class_names = sorted([d for d in os.listdir(data_dir) if os.path.isdir(os.path.join(data_dir, d)) and not d.startswith('.')])
    stats = {}
    class_hashes = {}

    for cat in class_names:
        cat_path = os.path.join(data_dir, cat)
        hashes = defaultdict(list)
        files = sorted([f for f in os.listdir(cat_path) if f.lower().endswith(('.jpg', '.jpeg', '.png'))])
        for f in files:
            fp = os.path.join(cat_path, f)
            with open(fp, 'rb') as f_obj:
                h = hashlib.md5(f_obj.read()).hexdigest()
            hashes[h].append(fp)
        stats[cat] = {"total_files": len(files), "unique_images": len(hashes)}
        class_hashes[cat] = hashes

    return class_names, class_hashes, stats

def prepare_data(data_dir, batch_size=32, split_strategy="hash_grouped", 
                 train_ratio=0.70, val_ratio=0.15, test_ratio=0.15, seed=42):
    """
    Prepara y divide los datos con estrategias para controlar el Data Leakage:
    - 'hash_grouped': Agrupa réplicas por hash. Ningún duplicado de Train existe en Val o Test.
    - 'unique_only': Utiliza únicamente las imágenes únicas reales (1 por hash).
    - 'random': División clásica aleatoria (produce fuga si hay duplicados).
    """
    if not os.path.isdir(data_dir):
        raise FileNotFoundError(f"No se encontró el directorio del dataset en: {data_dir}")

    class_names, class_hashes, stats = analyze_dataset_duplicates(data_dir)
    class_to_idx = {name: idx for idx, name in enumerate(class_names)}

    total_files = sum(s["total_files"] for s in stats.values())
    total_unique = sum(s["unique_images"] for s in stats.values())

    print(f"\n================ REPORTE DE INTEGRIDAD DEL DATASET ================")
    print(f"Directorio: {data_dir}")
    print(f"Total de archivos en disco: {total_files}")
    print(f"Total de imágenes ÚNICAS reales: {total_unique} (Resto son réplicas/clones)")
    for cat in class_names:
        tf = stats[cat]["total_files"]
        ui = stats[cat]["unique_images"]
        dup_ratio = ((tf - ui) / tf) * 100 if tf > 0 else 0
        print(f"  - {cat:<18}: {tf} archivos | {ui} únicas reales ({dup_ratio:.1f}% duplicados)")
    print(f"Estrategia de Split: {split_strategy.upper()}")
    print(f"===================================================================\n")

    train_samples, val_samples, test_samples = [], [], []
    random.seed(seed)

    if split_strategy in ("hash_grouped", "unique_only"):
        for cat_name, cat_idx in class_to_idx.items():
            hashes = class_hashes[cat_name]
            unique_hash_keys = list(hashes.keys())
            random.shuffle(unique_hash_keys)

            n_u = len(unique_hash_keys)
            n_tr = max(1, int(train_ratio * n_u))
            n_va = max(1, int(val_ratio * n_u))
            if n_tr + n_va >= n_u:
                n_tr = max(1, n_u - 2)
                n_va = 1

            train_h = set(unique_hash_keys[:n_tr])
            val_h = set(unique_hash_keys[n_tr:n_tr + n_va])
            test_h = set(unique_hash_keys[n_tr + n_va:])

            for h in train_h:
                fps = hashes[h]
                chosen = [fps[0]] if split_strategy == "unique_only" else fps
                train_samples.extend([(fp, cat_idx) for fp in chosen])

            for h in val_h:
                fps = hashes[h]
                chosen = [fps[0]] if split_strategy == "unique_only" else fps
                val_samples.extend([(fp, cat_idx) for fp in chosen])

            for h in test_h:
                fps = hashes[h]
                chosen = [fps[0]] if split_strategy == "unique_only" else fps
                test_samples.extend([(fp, cat_idx) for fp in chosen])

    else: # split_strategy == "random"
        print("ADVERTENCIA: Usando split aleatorio 'random'. Si el dataset tiene imágenes duplicadas,")
        print("ocurrirá Data Leakage (las mismas imágenes aparecerán en Train y Val).")
        all_samples = []
        for cat_name, cat_idx in class_to_idx.items():
            for h, fps in class_hashes[cat_name].items():
                for fp in fps:
                    all_samples.append((fp, cat_idx))
        random.shuffle(all_samples)
        n = len(all_samples)
        n_tr = int(train_ratio * n)
        n_va = int(val_ratio * n)
        train_samples = all_samples[:n_tr]
        val_samples = all_samples[n_tr:n_tr + n_va]
        test_samples = all_samples[n_tr + n_va:]

    train_tf, val_test_tf = build_transforms()

    train_dataset = PathDataset(train_samples, transform=train_tf)
    val_dataset = PathDataset(val_samples, transform=val_test_tf)
    test_dataset = PathDataset(test_samples, transform=val_test_tf)

    # Solo pin_memory si se usa CUDA (en MPS genera UserWarning innecesario)
    pin_mem = torch.cuda.is_available()

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, num_workers=2, pin_memory=pin_mem)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, num_workers=2, pin_memory=pin_mem)
    test_loader = DataLoader(test_dataset, batch_size=batch_size, shuffle=False, num_workers=2, pin_memory=pin_mem)

    print(f"Muestras asignadas -> Train: {len(train_samples)} | Val: {len(val_samples)} | Test: {len(test_samples)}\n")
    return train_loader, val_loader, test_loader, class_names, class_to_idx

def build_model(num_classes=5, pretrained=True, freeze_backbone=False):
    """
    Construye la arquitectura ResNet-18 con Transfer Learning.
    Si freeze_backbone=True, congela capas convolucionales y entrena solo el cabezal final.
    """
    weights = models.ResNet18_Weights.DEFAULT if pretrained else None
    model = models.resnet18(weights=weights)

    if freeze_backbone:
        for param in model.parameters():
            param.requires_grad = False

    # Reemplazar la capa clasificadora final
    in_features = model.fc.in_features
    model.fc = nn.Sequential(
        nn.Dropout(p=0.4),
        nn.Linear(in_features, num_classes)
    )
    return model

def train_one_epoch(model, dataloader, criterion, optimizer, device):
    """Ejecuta una época de entrenamiento."""
    model.train()
    running_loss = 0.0
    correct = 0
    total = 0

    pbar = tqdm(dataloader, desc="Entrenamiento", leave=False)
    for images, labels in pbar:
        images, labels = images.to(device), labels.to(device)

        optimizer.zero_grad()
        outputs = model(images)
        loss = criterion(outputs, labels)
        loss.backward()

        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=2.0)
        optimizer.step()

        running_loss += loss.item() * images.size(0)
        _, preds = torch.max(outputs, 1)
        correct += (preds == labels).sum().item()
        total += labels.size(0)

        pbar.set_postfix({"Loss": f"{loss.item():.4f}", "Acc": f"{correct/total:.3f}"})

    epoch_loss = running_loss / total
    epoch_acc = (correct / total) * 100.0
    return epoch_loss, epoch_acc

def evaluate(model, dataloader, criterion, device):
    """Evalúa el modelo en validación o test."""
    model.eval()
    running_loss = 0.0
    correct = 0
    total = 0

    all_preds = []
    all_labels = []

    with torch.no_grad():
        for images, labels in dataloader:
            images, labels = images.to(device), labels.to(device)
            outputs = model(images)
            loss = criterion(outputs, labels)

            running_loss += loss.item() * images.size(0)
            _, preds = torch.max(outputs, 1)
            correct += (preds == labels).sum().item()
            total += labels.size(0)

            all_preds.extend(preds.cpu().numpy())
            all_labels.extend(labels.cpu().numpy())

    epoch_loss = running_loss / total
    epoch_acc = (correct / total) * 100.0 if total > 0 else 0.0
    return epoch_loss, epoch_acc, np.array(all_preds), np.array(all_labels)

def plot_confusion_matrix(cm, class_names, save_path="confusion_matrix.png"):
    """Grafica y guarda la matriz de confusión con Seaborn y Matplotlib."""
    plt.figure(figsize=(9, 7))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues',
                xticklabels=class_names, yticklabels=class_names, cbar=True)
    plt.title("Matriz de Confusión - Clasificador de Suelos (ResNet-18)", fontsize=13, fontweight='bold')
    plt.ylabel("Etiqueta Real", fontsize=11)
    plt.xlabel("Predicción del Modelo", fontsize=11)
    plt.xticks(rotation=30, ha='right')
    plt.yticks(rotation=0)
    plt.tight_layout()
    plt.savefig(save_path, dpi=300)
    plt.close()
    print(f"Matriz de confusión guardada en: {save_path}")

def plot_training_history(history, save_path="training_history.png"):
    """Grafica las curvas de pérdida y precisión del entrenamiento."""
    epochs = range(1, len(history['train_loss']) + 1)
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))

    ax1.plot(epochs, history['train_loss'], label='Entrenamiento (Train)', color='#ff5722', linewidth=2.5)
    ax1.plot(epochs, history['val_loss'], label='Validación (Val)', color='#2196f3', linewidth=2.5)
    ax1.set_title('Pérdida por Época (Cross-Entropy Loss)', fontsize=12, fontweight='bold')
    ax1.set_xlabel('Época')
    ax1.set_ylabel('Loss')
    ax1.legend()
    ax1.grid(True, linestyle='--', alpha=0.5)

    ax2.plot(epochs, history['train_acc'], label='Entrenamiento (Train)', color='#4caf50', linewidth=2.5)
    ax2.plot(epochs, history['val_acc'], label='Validación (Val)', color='#9c27b0', linewidth=2.5)
    ax2.set_title('Precisión por Época (Accuracy %)', fontsize=12, fontweight='bold')
    ax2.set_xlabel('Época')
    ax2.set_ylabel('Accuracy (%)')
    ax2.legend()
    ax2.grid(True, linestyle='--', alpha=0.5)

    plt.tight_layout()
    plt.savefig(save_path, dpi=300)
    plt.close()
    print(f"Gráficas de entrenamiento guardadas en: {save_path}")

def compute_metrics(y_true, y_pred, num_classes, class_names):
    """Calcula matriz de confusión, precisión, recall y F1-score por clase."""
    cm = np.zeros((num_classes, num_classes), dtype=int)
    for t, p in zip(y_true, y_pred):
        cm[t, p] += 1

    print("\n---------------- Reporte de Clasificación ----------------")
    print(f"{'Clase':<20} {'Precision':<10} {'Recall':<10} {'F1-Score':<10} {'Soporte':<10}")
    print("-" * 62)

    precisions, recalls, f1s = [], [], []
    for i, name in enumerate(class_names):
        tp = cm[i, i]
        fp = cm[:, i].sum() - tp
        fn = cm[i, :].sum() - tp
        support = cm[i, :].sum()

        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0

        precisions.append(precision)
        recalls.append(recall)
        f1s.append(f1)

        print(f"{name:<20} {precision*100:>8.2f}% {recall*100:>8.2f}% {f1*100:>8.2f}% {support:>8}")

    macro_p = np.mean(precisions) * 100
    macro_r = np.mean(recalls) * 100
    macro_f1 = np.mean(f1s) * 100
    print("-" * 62)
    print(f"{'Macro Promedio':<20} {macro_p:>8.2f}% {macro_r:>8.2f}% {macro_f1:>8.2f}% {len(y_true):>8}")
    print("----------------------------------------------------------\n")
    return cm

def train_pipeline(data_dir="datasets/soil", model_save_path="best_soil_classifier.pth", 
                   epochs=10, batch_size=32, lr=0.0003, split_strategy="hash_grouped",
                   freeze_backbone=False, seed=42):
    """Pipeline completo de entrenamiento con validación y prueba libre de Data Leakage."""
    set_seed(seed)
    device = get_device()
    print(f"Dispositivo de cómputo seleccionado: {device}")

    train_loader, val_loader, test_loader, class_names, class_to_idx = prepare_data(
        data_dir=data_dir, batch_size=batch_size, split_strategy=split_strategy, seed=seed
    )

    model = build_model(num_classes=len(class_names), pretrained=True, freeze_backbone=freeze_backbone)
    model = model.to(device)

    trainable_params = [p for p in model.parameters() if p.requires_grad]
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.AdamW(trainable_params, lr=lr, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)

    history = {
        'train_loss': [], 'train_acc': [],
        'val_loss': [], 'val_acc': []
    }

    best_val_acc = 0.0

    print("Iniciando entrenamiento del clasificador de terrenos...")
    for epoch in range(1, epochs + 1):
        train_loss, train_acc = train_one_epoch(model, train_loader, criterion, optimizer, device)
        val_loss, val_acc, _, _ = evaluate(model, val_loader, criterion, device)
        scheduler.step()

        history['train_loss'].append(train_loss)
        history['train_acc'].append(train_acc)
        history['val_loss'].append(val_loss)
        history['val_acc'].append(val_acc)

        current_lr = scheduler.get_last_lr()[0]
        print(f"Época [{epoch:02d}/{epochs:02d}] "
              f"Train Loss: {train_loss:.4f} | Train Acc: {train_acc:.2f}% | "
              f"Val Loss: {val_loss:.4f} | Val Acc: {val_acc:.2f}% | LR: {current_lr:.6f}")

        if val_acc >= best_val_acc:
            best_val_acc = val_acc
            torch.save({
                'model_state_dict': model.state_dict(),
                'class_names': class_names,
                'class_to_idx': class_to_idx,
                'best_val_acc': best_val_acc,
                'arch': 'resnet18'
            }, model_save_path)

    plot_training_history(history, save_path="training_history.png")

    print(f"\nCargando checkpoint con mejor validación ({best_val_acc:.2f}%) para evaluar en Test...")
    checkpoint = torch.load(model_save_path, map_location=device)
    model.load_state_dict(checkpoint['model_state_dict'])

    test_loss, test_acc, y_pred, y_true = evaluate(model, test_loader, criterion, device)
    print(f"\n================ RESULTADOS FINALES TEST SET ================")
    print(f"Pérdida en Test: {test_loss:.4f}")
    print(f"Precisión Global en Test: {test_acc:.2f}%")
    print(f"============================================================")

    cm = compute_metrics(y_true, y_pred, len(class_names), class_names)
    plot_confusion_matrix(cm, class_names, save_path="confusion_matrix.png")

    return model, class_names

def predict(image_path, model_path="best_soil_classifier.pth", top_k=3):
    """Clasifica una imagen individual de suelo y muestra su descripción y confianza."""
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"No se encontró la imagen: {image_path}")
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"No se encontró el modelo: {model_path}. Por favor entrena primero el modelo.")

    device = get_device()
    checkpoint = torch.load(model_path, map_location=device)

    class_names = checkpoint['class_names']
    model = build_model(num_classes=len(class_names), pretrained=False)
    model.load_state_dict(checkpoint['model_state_dict'])
    model = model.to(device)
    model.eval()

    _, test_tf = build_transforms()

    raw_image = Image.open(image_path).convert('RGB')
    tensor_img = test_tf(raw_image).unsqueeze(0).to(device)

    with torch.no_grad():
        outputs = model(tensor_img)
        probs = torch.softmax(outputs, dim=1)[0].cpu().numpy()

    top_indices = np.argsort(probs)[::-1][:top_k]
    best_class = class_names[top_indices[0]]
    best_conf = probs[top_indices[0]] * 100

    info = SOIL_CLASSES_INFO.get(best_class, {})

    print(f"\n================ INFERENCIA DE TERRENO ================")
    print(f"Imagen analizada: {image_path}")
    print(f"Predicción Principal: {best_class} ({best_conf:.2f}% de confianza)")
    print(f"Descripción (EN): {info.get('description', 'N/A')}")
    print(f"Descripción (ES): {info.get('es_desc', 'N/A')}")
    print(f"\nTop-{top_k} Probabilidades:")
    for rank, idx in enumerate(top_indices, 1):
        c_name = class_names[idx]
        c_prob = probs[idx] * 100
        print(f"  {rank}. {c_name:<18}: {c_prob:6.2f}%")
    print(f"=======================================================\n")

    return best_class, best_conf, probs

def main():
    parser = argparse.ArgumentParser(description="Clasificador de Terreno con PyTorch y Transfer Learning")
    parser.add_argument("--mode", type=str, default="train", choices=["train", "predict", "test"],
                        help="Modo de ejecución: 'train' para entrenar, 'predict' para clasificar, 'test' para evaluar.")
    parser.add_argument("--split-strategy", type=str, default="hash_grouped", choices=["hash_grouped", "unique_only", "random"],
                        help="Estrategia de división: 'hash_grouped' (sin fuga), 'unique_only' (solo 53 fotos únicas), 'random' (clásica).")
    parser.add_argument("--freeze-backbone", action="store_true", help="Congelar el extractor convolucional de ResNet18.")
    parser.add_argument("--data-dir", type=str, default="datasets/soil", help="Ruta al directorio de datasets de suelo.")
    parser.add_argument("--model-path", type=str, default="best_soil_classifier.pth", help="Ruta para guardar o cargar el modelo .pth.")
    parser.add_argument("--image", type=str, default=None, help="Ruta de la imagen a clasificar en modo predict.")
    parser.add_argument("--epochs", type=int, default=10, help="Número de épocas de entrenamiento (default: 10).")
    parser.add_argument("--batch-size", type=int, default=32, help="Tamaño de batch (default: 32).")
    parser.add_argument("--lr", type=float, default=0.0003, help="Tasa de aprendizaje (default: 0.0003).")
    parser.add_argument("--seed", type=int, default=42, help="Semilla aleatoria para reproducibilidad.")

    args = parser.parse_args()

    base_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = args.data_dir if os.path.isabs(args.data_dir) else os.path.join(base_dir, args.data_dir)
    model_path = args.model_path if os.path.isabs(args.model_path) else os.path.join(base_dir, args.model_path)

    if args.mode == "train":
        train_pipeline(
            data_dir=data_dir,
            model_save_path=model_path,
            epochs=args.epochs,
            batch_size=args.batch_size,
            lr=args.lr,
            split_strategy=args.split_strategy,
            freeze_backbone=args.freeze_backbone,
            seed=args.seed
        )
    elif args.mode == "predict":
        if not args.image:
            print("Error: Debe proporcionar la ruta a una imagen con --image para hacer inferencia.")
            sys.exit(1)
        image_path = args.image if os.path.exists(args.image) else os.path.join(base_dir, args.image)
        predict(image_path=image_path, model_path=model_path)
    elif args.mode == "test":
        device = get_device()
        _, _, test_loader, class_names, _ = prepare_data(
            data_dir=data_dir, batch_size=args.batch_size, split_strategy=args.split_strategy, seed=args.seed
        )
        checkpoint = torch.load(model_path, map_location=device)
        model = build_model(num_classes=len(class_names), pretrained=False)
        model.load_state_dict(checkpoint['model_state_dict'])
        model = model.to(device)
        criterion = nn.CrossEntropyLoss()
        test_loss, test_acc, y_pred, y_true = evaluate(model, test_loader, criterion, device)
        print(f"Test Loss: {test_loss:.4f} | Test Acc: {test_acc:.2f}%")
        cm = compute_metrics(y_true, y_pred, len(class_names), class_names)
        plot_confusion_matrix(cm, class_names, save_path=os.path.join(base_dir, "confusion_matrix.png"))

if __name__ == "__main__":
    main()
