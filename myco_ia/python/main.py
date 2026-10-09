import numpy as np
import matplotlib.pyplot as plt
import csv
from normalizer import normalize_soil_parameters, generate_multi_sensor_terrain

class FungalSoilMeasurementCA:
    def __init__(self, soil_measurements: np.ndarray, seed_pos=None, cfu_concentration=0.5):
        """
        Args:
            soil_measurements (np.ndarray): Matriz 2D (height, width) con valores de 0.0 a 1.0
                                            que representan la idoneidad del terreno (nutrientes, humedad, compactación).
            seed_pos (tuple): Coordenadas (x, y) donde el robot inyecta la cápsula de micelio.
            cfu_concentration (float): Concentración de UFC/g normalizada (0.1 a 1.0).
                                       Representa la densidad del inóculo biológico en la cápsula.
        """
        self.height, self.width = soil_measurements.shape
        
        # Matriz de recursos/idoneidad basada en mediciones normalizadas
        self.nutrients = np.clip(soil_measurements, 0.0, 1.0)
        
        # Parámetro de UFC guardado como "vigor" del micelio (0.1 a 1.0)
        self.cfu_vigor = float(np.clip(cfu_concentration, 0.1, 1.0))
        
        # Estados de la celosía:
        # 0: Suelo virgen / no explorado
        # 1: Suelo con potencial medido (disponible para descomposición)
        # 2: Punta de hifa activa (exploración actual del micelio)
        # 3: Red de micelio madura establecida (transporte)
        # 4: Obstáculo / zona impenetrable (medición cercana a 0 o restricción física)
        self.grid = np.zeros((self.height, self.width), dtype=int)
        
        # Marcar celdas con potencial de nutrientes (umbral > 0.1)
        self.grid[self.nutrients > 0.1] = 1
        
        # Identificar obstáculos impenetrables (ej. rocas o suelo ultra compactado = 0.0 absoluto)
        self.grid[self.nutrients <= 0.02] = 4

        # Posición inicial (Inoculación del robot)
        if seed_pos is None:
            self.start_x, self.start_y = self.width // 2, self.height // 2
        else:
            self.start_x, self.start_y = seed_pos
            
        # Inoculación inicial con radio derivado de la densidad de UFC/g
        self.inoculate((self.start_x, self.start_y), self.cfu_vigor)

    def inoculate(self, seed_pos, cfu_concentration=None):
        """
        Inocula una biocápsula en 'seed_pos'. A mayor concentración de UFC/g,
        mayor es el radio de colonización inicial (radio 0 a 2, hasta ~13 celdas).
        """
        if cfu_concentration is not None:
            self.cfu_vigor = float(np.clip(cfu_concentration, 0.1, 1.0))
            
        sx, sy = seed_pos
        self.start_x, self.start_y = sx, sy
        
        # Radio de 0 (1 celda) hasta 2 (área circular ~13 celdas) según vigor
        initial_radius = int(np.floor(self.cfu_vigor * 2.5))
        
        for dy in range(-initial_radius, initial_radius + 1):
            for dx in range(-initial_radius, initial_radius + 1):
                if dx * dx + dy * dy <= initial_radius * initial_radius:
                    ny, nx = sy + dy, sx + dx
                    if 0 <= ny < self.height and 0 <= nx < self.width:
                        if self.grid[ny, nx] != 4:  # Respetar obstáculos/rocas
                            self.grid[ny, nx] = 2   # Punta activa
                            self.nutrients[ny, nx] = 0.0 # Consume el punto de partida

    def step(self):
        new_grid = self.grid.copy()
        new_nutrients = self.nutrients.copy()
        
        # Encontrar todas las puntas de hifas activas actuales (estado 2)
        tips = np.argwhere(self.grid == 2)
        
        for y, x in tips:
            # La hifa madura, convirtiéndose en red de transporte (estado 3)
            new_grid[y, x] = 3
            
            # Vecindad de Moore (8 direcciones)
            neighbors = [
                (y-1, x), (y+1, x), (y, x-1), (y, x+1),
                (y-1, x-1), (y-1, x+1), (y+1, x-1), (y+1, x+1)
            ]
            
            valid_neighbors = []
            nutrient_weights = []
            
            for ny, nx in neighbors:
                if 0 <= ny < self.height and 0 <= nx < self.width:
                    # No avanzar sobre micelio maduro (3) ni obstáculos (4)
                    if self.grid[ny, nx] != 3 and self.grid[ny, nx] != 4:
                        valid_neighbors.append((ny, nx))
                        # Quimiotropismo guiado por los parámetros reales de medición + inercia de exploración
                        weight = self.nutrients[ny, nx] + 0.05
                        nutrient_weights.append(weight)
            
            if valid_neighbors:
                nutrient_weights = np.array(nutrient_weights)
                total_w = np.sum(nutrient_weights)
                
                if total_w > 0:
                    probs = nutrient_weights / total_w
                else:
                    probs = np.ones(len(valid_neighbors)) / len(valid_neighbors)
                
                local_quality = np.mean(nutrient_weights)
                
                # 2. IMPACTO DE LAS UFC EN EL CRECIMIENTO Y RAMIFICACIÓN
                # La concentración de UFC aumenta la probabilidad base de ramificación
                base_branch_prob = 0.4 if local_quality > 0.5 else 0.15
                
                # Modificador de vigor: aumenta la ramificación hasta un 50% extra si las UFC son altas
                branch_prob = min(1.0, base_branch_prob * (1.0 + (self.cfu_vigor * 0.5)))
                
                # Determinar cantidad de ramas a generar
                if np.random.rand() < branch_prob:
                    # Si el vigor por UFC es muy alto (>=0.7), posibilidad de triple ramificación
                    if self.cfu_vigor >= 0.7 and np.random.rand() < (self.cfu_vigor * 0.3):
                        num_branches = 3
                    else:
                        num_branches = 2
                else:
                    num_branches = 1
                
                chosen_indices = np.random.choice(
                    len(valid_neighbors), 
                    size=min(num_branches, len(valid_neighbors)), 
                    p=probs, 
                    replace=False
                )
                
                for idx in chosen_indices:
                    ny, nx = valid_neighbors[idx]
                    new_grid[ny, nx] = 2 # Nueva punta activa explorando
                    
                    # El micelio consume/transforma los parámetros del terreno medido
                    if new_nutrients[ny, nx] > 0:
                        new_nutrients[ny, nx] = max(0.0, new_nutrients[ny, nx] - 0.35)

        self.grid = new_grid
        self.nutrients = new_nutrients

# Alias para compatibilidad con código existente
FungalSoilCA = FungalSoilMeasurementCA

def generate_sample_terrain(grid_size=120):
    """Genera la matriz de terreno procesada a través del normalizador multi-sensor."""
    suitability, _ = generate_multi_sensor_terrain(grid_size)
    return suitability

if __name__ == "__main__":
    grid_size = 120
    terrain_map, raw_sensors = generate_multi_sensor_terrain(grid_size)
    robot_injection_point = (10, 10) # Coordenada (x, y) donde el robot depositó la cápsula
    
    # Parámetro biológico: concentración de UFC/g normalizada (0.1 a 1.0)
    # Por ejemplo, cápsula de alta densidad con 85,000 UFC/g -> 0.85
    cfu_normalizado = 0.85
    
    steps = 80
    sim = FungalSoilMeasurementCA(
        soil_measurements=terrain_map, 
        seed_pos=robot_injection_point,
        cfu_concentration=cfu_normalizado
    )

    # Exportar datos a CSV
    with open('simulacion_micelio.csv', 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(["step", "mycelium_size", "active_tips"])
        
        for step_num in range(steps):
            sim.step()
            mycelium_size = int(np.sum(sim.grid == 3))
            active_tips = int(np.sum(sim.grid == 2))
            writer.writerow([step_num, mycelium_size, active_tips])

    # Visualización con matplotlib mostrando los sensores y el crecimiento
    fig, axes = plt.subplots(1, 2, figsize=(14, 6))

    # 1. Mapa de idoneidad calculado con los 3 sensores ponderados al 33.33%
    axes[0].imshow(terrain_map, cmap='inferno', interpolation='nearest')
    axes[0].set_title("Índice de Idoneidad Compuesto (MO + Humedad + Compactación)", color='white')
    axes[0].plot(robot_injection_point[0], robot_injection_point[1], 'go', markersize=8, label='Inyección Robot')
    axes[0].legend(loc='upper right')
    axes[0].axis('off')

    # 2. Resultado del crecimiento del micelio sobre las mediciones
    cmap_fungus = plt.matplotlib.colors.ListedColormap(['#111111', '#2d3748', '#ff4500', '#00ffcc', '#333333'])
    axes[1].imshow(sim.grid, cmap=cmap_fungus, interpolation='nearest')
    axes[1].set_title(f"Exploración del Micelio (Paso {steps})", color='white')
    axes[1].axis('off')

    fig.patch.set_facecolor('#0b0f19')
    plt.tight_layout()
    # plt.show()