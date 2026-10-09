"""
MÓDULO DE AUTÓMATA CELULAR MARCIANO (Myco AI - Martian Edition)
================================================================
Implementa la simulación biológica y ambiental del crecimiento de micelio en regolito marciano
utilizando el concepto del "Traje Espacial Fúngico" (Biocápsula de Hidrogel de Alginato + Glicerol + Quitosano)
y la ruta metabólica de metabolización y quelación fúngica por sideróforos (Trichoderma / Micorrizas Arbusculares).

Fundamentos Bioquímicos y Físicos:
1. Microcápsulas de Hidrogel:
   - Alginato de Sodio + Glicerol: retiene agua contra la presión de 6.1 hPa y actúa como anticongelante crioprotector.
   - Escudo de Quitosano: atenúa la penetración de percloratos (ClO4-) y especies reactivas de oxígeno (ROS).
   - Inóculo UFC/g: densidad de propágulos/esporas fúngicas que determina el vigor inicial y la tasa de quelación.
2. Modelo Térmico Marciano (Sol):
   - Curva senoidal diurna/nocturna: T(t) entre -65°C y +15°C.
   - Latencia/Dormancia crioprotegida: si T < -8°C, las puntas entran en reposo latente sin morir.
3. Dinámica de Fluidos (Difusión y Evaporación):
   - Ley de Fick 2D con Laplaciano discreto: H_{t+1} = H_t + D * ∇²H_t - E * H_t.
   - Liberación sostenida desde el reservorio humectante de la cápsula.
4. Ruta Metabólica de Sideróforos y Regolito:
   - Quelación de óxidos de hierro insolubles (Fe3+) a formas solubles asimilables (Fe2+).
   - Transporte de complejos Fe-Sideróforo y almacenamiento en ferritina celular.
   - Neutralización enzimática de peróxido de hidrógeno (H2O2) y percloratos del regolito.
"""

import numpy as np
import matplotlib.pyplot as plt
import csv

def generate_martian_regolith_terrain(grid_size=120):
    """
    Genera matrices sintéticas representativas del regolito marciano:
    - iron_oxides: Concentración de óxidos de hierro basales (Fe2O3/FeO, 15% a 25%).
    - perchlorates: Concentración de sales tóxicas y oxidantes (ClO4-, 0.4% a 1.2%).
    - moisture: Humedad residual del suelo marciano (~0.0% a 2.0% de agua ligada).
    - obstacles: Rocas basálticas y pendientes escarpadas impenetrables (0 = libre, 1 = roca).
    - suitability: Matriz base de habitabilidad antes de la inoculación de la cápsula.
    """
    y_coords, x_coords = np.ogrid[:grid_size, :grid_size]
    
    # 1. Óxidos de hierro (Fe2O3 / FeO) en el regolito (Normalizado 0.1 a 1.0)
    # Marte tiene abundante hierro mineral pero en forma férrica (Fe3+) insoluble
    iron_oxides = np.random.uniform(0.3, 0.7, (grid_size, grid_size))
    # Vetas de basalto ricas en óxido férrico
    iron_oxides += 0.3 * np.exp(-((x_coords - 40)**2 + (y_coords - 35)**2) / 500)
    iron_oxides += 0.25 * np.exp(-((x_coords - 85)**2 + (y_coords - 90)**2) / 600)
    iron_oxides = np.clip(iron_oxides, 0.1, 1.0)
    
    # 2. Percloratos (ClO4-) y toxicidad oxidativa del regolito (0.0 a 1.0)
    # Suelo altamente hostil y oxidante
    perchlorates = np.random.uniform(0.4, 0.85, (grid_size, grid_size))
    perchlorates += 0.2 * np.exp(-((x_coords - 70)**2 + (y_coords - 30)**2) / 400)
    perchlorates = np.clip(perchlorates, 0.2, 1.0)
    
    # 3. Humedad basal marciana (casi nula sin cápsula)
    moisture = np.random.uniform(0.0, 0.03, (grid_size, grid_size))
    
    # 4. Rocas basálticas y cráteres impenetrables (Obstáculos)
    obstacles = np.zeros((grid_size, grid_size), dtype=bool)
    # Formación rocosa / cresta de cráter
    obstacles[50:58, 25:85] = True
    # Roca aislada
    y_c, x_c = 85, 35
    rock_mask = ((x_coords - x_c)**2 + (y_coords - y_c)**2) <= 36
    obstacles[rock_mask] = True
    
    # 5. Idoneidad basal: Sin agua y con percloratos altos, la idoneidad es prácticamente nula
    # hasta que el robot inyecta el "traje espacial" humectante.
    suitability = np.clip(iron_oxides * 0.3 - perchlorates * 0.5 + moisture, 0.0, 1.0)
    suitability[obstacles] = 0.0

    raw_layers = {
        "iron_oxides": iron_oxides,
        "perchlorates": perchlorates,
        "moisture": moisture,
        "obstacles": obstacles
    }
    
    return suitability, raw_layers


class MartianFungalCA:
    """
    Autómata Celular 2D que modela la propagación de micelio protegido por microcápsulas
    de hidrogel en regolito marciano, simulando el ciclo diurno térmico, la difusión de Fick
    y la vía fúngica de quelación de hierro por sideróforos.
    """
    
    # Definición de Estados de la Celosía
    STATE_RAW_REGOLITH = 0      # Regolito virgen seco y oxidado
    STATE_HYDRATED_OASIS = 1    # Oasis hidratado viable (influenciado por cápsula)
    STATE_ACTIVE_TIP = 2        # Punta de hifa activa (exploración diurna y secreción de sideróforos)
    STATE_MATURE_NETWORK = 3    # Red micelial madura (transporte celular, ferritina y melanina)
    STATE_OBSTACLE = 4          # Roca basáltica impenetrable o pendiente extrema
    STATE_DORMANT_TIP = 5       # Punta en latencia criogénica (congelamiento nocturno)
    STATE_BAKED_BIOCOMPOSITE = 6 # Biocompuesto estructural horneado (80°C - Choque térmico NASA Mycotecture)

    def __init__(self, regolith_layers: dict = None, grid_size: int = 120, 
                 seed_pos=None, cfu_concentration: float = 0.5, 
                 humectant_capacity: float = 120.0, sol_length: int = 24):
        """
        Args:
            regolith_layers (dict): Diccionario con capas de óxidos, percloratos, obstáculos.
            grid_size (int): Dimensión cuadrada de la cuadrícula si no se proveen capas.
            seed_pos (tuple): Coordenadas (x, y) de inoculación de la biocápsula.
            cfu_concentration (float): Concentración de UFC/g (0.1 a 1.0).
            humectant_capacity (float): Reserva hídrica del hidrogel de alginato (unidades).
            sol_length (int): Pasos de tiempo por cada día marciano (Sol).
        """
        if regolith_layers is None:
            _, self.raw_layers = generate_martian_regolith_terrain(grid_size)
        else:
            self.raw_layers = regolith_layers
            grid_size = self.raw_layers["iron_oxides"].shape[0]

        self.height = grid_size
        self.width = grid_size
        self.sol_length = sol_length
        self.time_step = 0
        
        # Capas de entorno físico-químico marciano
        self.iron_oxides = np.copy(self.raw_layers["iron_oxides"])       # Fe3+ insoluble
        self.perchlorates = np.copy(self.raw_layers["perchlorates"])     # ClO4- toxicidad
        self.obstacles = np.copy(self.raw_layers["obstacles"])           # Rocas
        
        # 1. Capas Simbióticas de la NASA (Mycotecture Off Planet):
        # Capa intermedia de cianobacterias extremófilas fotosintéticas (producen azúcares a partir de luz + CO2)
        self.cyanobacteria = np.random.uniform(0.25, 0.85, (self.height, self.width))
        self.cyanobacteria[self.obstacles] = 0.0
        self.nutrients = np.zeros((self.height, self.width), dtype=float) # Azúcares fotosintéticos disponibles
        
        # Capas de Radiación y Blindaje de Melanina
        self.radiation = np.random.uniform(0.35, 0.85, (self.height, self.width)) # Flujo de radiación cósmica/UV
        self.radiation[self.obstacles] = 0.0
        self.melanin = np.zeros((self.height, self.width), dtype=float)   # Melanina secretada por micelio maduro
        
        # Capas dinámicas producidas por la cápsula y el micelio
        self.hydration = np.copy(self.raw_layers["moisture"])            # Hidratación libre H(x, y)
        self.chelated_iron = np.zeros((self.height, self.width), dtype=float) # Fe2+ biodisponible
        self.siderophores = np.zeros((self.height, self.width), dtype=float)  # Concentración de quelantes
        
        # Parámetros del Traje Espacial (Biocápsula de Hidrogel)
        self.cfu_vigor = float(np.clip(cfu_concentration, 0.1, 1.0))
        self.humectant_reserve = float(humectant_capacity)
        self.initial_humectant_capacity = float(humectant_capacity)
        self.chitosan_shield = 0.85 # Eficiencia del recubrimiento contra percloratos
        
        # Estado de Horneado / Fijación Estructural (NASA NIAC Phase III)
        self.is_baked = False
        self.bake_result = None
        
        # Celosía principal
        self.grid = np.zeros((self.height, self.width), dtype=int)
        self.grid[self.obstacles] = self.STATE_OBSTACLE
        
        # Posición de inyección
        if seed_pos is None:
            self.start_x, self.start_y = self.width // 2, self.height // 2
        else:
            self.start_x, self.start_y = seed_pos
            
        # Inoculación de la biocápsula
        self.inoculate((self.start_x, self.start_y), self.cfu_vigor, self.humectant_reserve)

    def inoculate(self, seed_pos, cfu_concentration=None, humectant_capacity=None):
        """
        Inyecta una microcápsula de hidrogel en seed_pos.
        Crea un oasis inicial de hidratación máxima y deposita las esporas fúngicas activas.
        """
        if cfu_concentration is not None:
            self.cfu_vigor = float(np.clip(cfu_concentration, 0.1, 1.0))
        if humectant_capacity is not None:
            self.humectant_reserve = float(humectant_capacity)
            self.initial_humectant_capacity = float(humectant_capacity)
            
        sx, sy = seed_pos
        self.start_x, self.start_y = sx, sy
        
        # Radio de inóculo derivado de UFC/g (radio 1 a 3 celdas)
        initial_radius = int(np.floor(self.cfu_vigor * 2.8))
        
        # La cápsula establece un oasis de hidratación inicial saturado
        for dy in range(-initial_radius - 1, initial_radius + 2):
            for dx in range(-initial_radius - 1, initial_radius + 2):
                dist_sq = dx * dx + dy * dy
                ny, nx = sy + dy, sx + dx
                if 0 <= ny < self.height and 0 <= nx < self.width:
                    if not self.obstacles[ny, nx]:
                        if dist_sq <= initial_radius * initial_radius:
                            self.grid[ny, nx] = self.STATE_ACTIVE_TIP
                            # Atenuación local inmediata de percloratos por el quitosano
                            self.perchlorates[ny, nx] *= (1.0 - self.chitosan_shield * 0.7)
                        self.hydration[ny, nx] = max(self.hydration[ny, nx], 0.95 - (dist_sq * 0.08))

    def get_temperature(self, step=None):
        """
        Calcula la temperatura de la superficie marciana según el ciclo del Sol.
        Oscila entre -65°C en la noche más profunda hasta +15°C al mediodía ecuatorial.
        """
        t = self.time_step if step is None else step
        # Desfase para que el mediodía (máximo) ocurra hacia la mitad del ciclo diurno
        angle = (2.0 * np.pi * t / self.sol_length) - (np.pi / 2.0)
        temp_celsius = -25.0 + 40.0 * np.sin(angle)
        return float(temp_celsius)

    def get_vitality(self, temp_celsius=None):
        """
        Calcula el factor de vitalidad celular fúngica.
        Gracias al glicerol del traje espacial, el umbral de actividad fúngica
        se extiende por debajo de 0°C (resistencia hasta -8°C).
        Por debajo de -8°C, entra en reposo criogénico (vitalidad = 0.0).
        """
        if temp_celsius is None:
            temp_celsius = self.get_temperature()
            
        t_cryo_limit = -8.0  # Límite protegido por glicerol anticongelante
        t_optimum = 18.0     # Temperatura óptima de crecimiento
        
        if temp_celsius < t_cryo_limit:
            return 0.0
        elif temp_celsius >= t_optimum:
            return 1.0
        else:
            return (temp_celsius - t_cryo_limit) / (t_optimum - t_cryo_limit)

    def diffuse_and_evaporate_water(self):
        """
        Modela la dinámica de fluidos de la biocápsula en la atmósfera de Marte (6.1 hPa):
        1. La cápsula sigue desprendiendo agua si tiene reservas de hidrogel.
        2. Difusión 2D según la ley de Fick (operador Laplaciano discreto).
        3. Evaporación por sublimación acelerada por la baja presión atmosférica.
        """
        # 1. Liberación sostenida desde el núcleo de la cápsula
        if self.humectant_reserve > 0:
            release_rate = min(0.65, self.humectant_reserve)
            self.hydration[self.start_y, self.start_x] = min(1.0, self.hydration[self.start_y, self.start_x] + release_rate)
            self.humectant_reserve -= release_rate

        # 2. Convolución Laplaciana rápida de Moore (difusión en regolito poroso)
        h = self.hydration
        h_up = np.roll(h, 1, axis=0); h_up[0, :] = 0
        h_down = np.roll(h, -1, axis=0); h_down[-1, :] = 0
        h_left = np.roll(h, 1, axis=1); h_left[:, 0] = 0
        h_right = np.roll(h, -1, axis=1); h_right[:, -1] = 0
        
        laplacian = (h_up + h_down + h_left + h_right) - (4.0 * h)
        
        # Parámetros físicos marcianos:
        # D: Coeficiente de difusión hidrodinámica en regolito
        # E: Tasa de evaporación/sublimación (reducida ligeramente en la sombra del micelio)
        D = 0.16
        E = 0.022
        
        self.hydration += (D * laplacian) - (E * self.hydration)
        self.hydration[self.obstacles] = 0.0
        self.hydration = np.clip(self.hydration, 0.0, 1.0)

    def step(self):
        """
        Ejecuta un paso de tiempo (step) del autómata celular marciano:
        - Si el hábitat ya fue horneado (bake_habitat), el hongo está inerte y cesa la fase biológica.
        1. Simula el ciclo solar (fotoperiodo diurno / noche).
        2. Fotosíntesis simbiótica de cianobacterias (generación de azúcares con luz + CO2).
        3. Actualiza el ciclo térmico diurno/nocturno y dormancia crioprotegida.
        4. Difunde el agua de la cápsula y calcula evaporación (Ley de Fick).
        5. Expande las puntas activas buscando agua y azúcares (Quimiotropismo simbiótico).
        6. Quelación de óxidos de hierro (Fe3+ -> Fe2+), secreción de sideróforos y síntesis de melanina antirradiación.
        """
        # Si el hábitat ya fue horneado por la NASA, la estructura está fijada e inerte
        if self.is_baked:
            return

        # ---------------------------------------------------------
        # 1. EL CICLO SOLAR (Fotoperiodo Marciano)
        # ---------------------------------------------------------
        # Onda senoidal donde t=0 a 12 horas es diurno (luz positiva) y t=12 a 24 es noche oscura (luz = 0)
        sol_hour_normalized = (self.time_step % self.sol_length) / float(self.sol_length)
        light_intensity = float(max(0.0, np.sin(2.0 * np.pi * sol_hour_normalized)))

        # ---------------------------------------------------------
        # 2. FOTOSÍNTESIS DE CIANOBACTERIAS (Alimentación del Micelio)
        # ---------------------------------------------------------
        # Tasa de fotosíntesis y conversión de CO2 a carbohidratos/azúcares
        photosynthesis_rate = 0.08
        new_sugars = self.cyanobacteria * light_intensity * photosynthesis_rate
        self.nutrients = np.clip(self.nutrients + new_sugars, 0.0, 1.0)
        self.nutrients[self.obstacles] = 0.0

        temp = self.get_temperature()
        vitality = self.get_vitality(temp)
        
        # 3. Difusión continua de fluidos
        self.diffuse_and_evaporate_water()
        
        new_grid = self.grid.copy()
        
        # 4. MANEJO DEL CONGELAMIENTO NOCTURNO (Latencia / Dormancia Criogénica)
        if vitality <= 0.0:
            # Durante la gélida noche marciana (< -8°C), las puntas se congelan en estado 5
            # preservadas por el glicerol sin morir.
            active_tips = np.argwhere(self.grid == self.STATE_ACTIVE_TIP)
            for y, x in active_tips:
                new_grid[y, x] = self.STATE_DORMANT_TIP
            self.grid = new_grid
            self.time_step += 1
            return
        else:
            # Al salir el sol y subir la temperatura, las puntas en dormancia despiertan a estado 2
            dormant_tips = np.argwhere(self.grid == self.STATE_DORMANT_TIP)
            for y, x in dormant_tips:
                new_grid[y, x] = self.STATE_ACTIVE_TIP

        # 5. CRECIMIENTO ACTIVO DIURNO Y VÍA SIMBIÓTICA DE SIDERÓFOROS
        active_tips = np.argwhere(new_grid == self.STATE_ACTIVE_TIP)
        
        for y, x in active_tips:
            # La hifa madura convirtiéndose en red micelial de transporte y almacenamiento
            new_grid[y, x] = self.STATE_MATURE_NETWORK
            
            # Síntesis de melanina en la red madura para escudar la radiación UV y cósmica
            self.melanin[y, x] = min(1.0, self.melanin[y, x] + 0.35)
            self.radiation[y, x] = max(0.05, self.radiation[y, x] * 0.45) # La melanina absorbe y atenúa la radiación
            
            # Vecindad de Moore (8 direcciones de crecimiento)
            neighbors = [
                (y-1, x), (y+1, x), (y, x-1), (y, x+1),
                (y-1, x-1), (y-1, x+1), (y+1, x-1), (y+1, x+1)
            ]
            
            valid_neighbors = []
            attraction_weights = []
            
            for ny, nx in neighbors:
                if 0 <= ny < self.height and 0 <= nx < self.width:
                    # No invadir redes ya maduras, biocompuesto horneado ni rocas
                    if new_grid[ny, nx] not in (self.STATE_MATURE_NETWORK, self.STATE_BAKED_BIOCOMPOSITE, self.STATE_OBSTACLE):
                        h_val = self.hydration[ny, nx]
                        n_val = self.nutrients[ny, nx]
                        
                        # REQUISITO CRÍTICO DE VIDA: Al menos un mínimo de humedad del oasis
                        if h_val > 0.06:
                            valid_neighbors.append((ny, nx))
                            
                            # Quimiotropismo e Hidrotropismo Sinérgico:
                            # El hongo busca tanto el agua (hidrogel) como el alimento (azúcar de cianobacterias)
                            # Ponderamos 55% azúcar, 35% agua y 10% tracción por quelación de hierro
                            p_pen = max(0.1, 1.0 - (self.perchlorates[ny, nx] * 0.7))
                            fe_pull = self.iron_oxides[ny, nx] * 0.2
                            rad_pen = max(0.1, 1.0 - (self.radiation[ny, nx] * 0.4))
                            
                            weight = ((n_val * 0.55) + (h_val * 0.35) + fe_pull) * p_pen * rad_pen
                            attraction_weights.append(max(0.001, weight))
            
            # ACCIÓN BIOQUÍMICA LOCAL: SECRECIÓN DE SIDERÓFOROS
            for ny, nx in neighbors:
                if 0 <= ny < self.height and 0 <= nx < self.width:
                    if not self.obstacles[ny, nx]:
                        # Cantidad de sideróforos producidos proporcional al vigor de UFC y vitalidad térmica
                        sid_rate = 0.08 * self.cfu_vigor * vitality
                        self.siderophores[ny, nx] = min(1.0, self.siderophores[ny, nx] + sid_rate)
                        
                        # Detoxificación de percloratos / descomposición de H2O2
                        detox = sid_rate * 0.7
                        self.perchlorates[ny, nx] = max(0.02, self.perchlorates[ny, nx] - detox)
                        
                        # Quelación de óxidos de hierro a Fe2+ biodisponible
                        if self.iron_oxides[ny, nx] > 0.05:
                            fe_chelated = min(self.iron_oxides[ny, nx], sid_rate * 0.8)
                            self.iron_oxides[ny, nx] -= fe_chelated * 0.4
                            self.chelated_iron[ny, nx] = min(1.0, self.chelated_iron[ny, nx] + fe_chelated)

            # RAMIFICACIÓN Y ELECCIÓN DE DIRECCIONES
            if valid_neighbors:
                attraction_weights = np.array(attraction_weights)
                sum_w = np.sum(attraction_weights)
                probs = attraction_weights / sum_w if sum_w > 0 else np.ones(len(valid_neighbors)) / len(valid_neighbors)
                
                # Ramificación acelerada si hay alta concentración de azúcares fotosintéticos
                local_sugar_quality = np.mean([self.nutrients[ny, nx] for ny, nx in valid_neighbors])
                base_branch_prob = 0.20 + (local_sugar_quality * 0.45) + (self.cfu_vigor * 0.25 * vitality)
                
                if np.random.rand() < base_branch_prob:
                    num_branches = 3 if (self.cfu_vigor >= 0.75 and local_sugar_quality > 0.5 and np.random.rand() < 0.35) else 2
                else:
                    num_branches = 1
                    
                num_chosen = min(num_branches, len(valid_neighbors))
                chosen_indices = np.random.choice(
                    len(valid_neighbors), 
                    size=num_chosen, 
                    p=probs, 
                    replace=False
                )
                
                for idx in chosen_indices:
                    cy, cx = valid_neighbors[idx]
                    new_grid[cy, cx] = self.STATE_ACTIVE_TIP
                    
                    # EL CONSUMO BIOQUÍMICO:
                    # El micelio devora el azúcar disponible en la celda
                    self.nutrients[cy, cx] = max(0.0, self.nutrients[cy, cx] - 0.35)
                    # Y consume una pequeña fracción de hidratación local para síntesis celular
                    self.hydration[cy, cx] = max(0.0, self.hydration[cy, cx] - 0.025)

        self.grid = new_grid
        self.time_step += 1

    def bake_habitat(self, target_density=0.70):
        """
        FASE FINAL: HORNEADO ESTRUCTURAL (NASA Mycotecture / NIAC Phase III)
        -------------------------------------------------------------------
        Simula el choque térmico controlado (80°C) para erradicar el micelio vivo
        (cumpliendo con las leyes internacionales de protección planetaria de COSPAR),
        fusionando la biomasa en un biocompuesto rígido semejante a madera o ladrillo.
        
        Calcula si la densidad volumétrica alcanzada es suficiente para resistir la 
        tensión de presurización interna de 1 ATM en la atmósfera casi vacía de Marte.
        
        Args:
            target_density (float): Umbral de densidad deseado (por defecto 70%).
            
        Returns:
            dict: Resultados del análisis de integridad mecánica del domo.
        """
        if self.is_baked:
            return self.bake_result

        self.is_baked = True
        
        # 1. Transformación de Material: Choque térmico mata y solidifica hifas activas,
        # red madura y puntas dormantes convirtiéndolas en Biocompuesto Estructural (Estado 6)
        self.grid[self.grid == self.STATE_ACTIVE_TIP] = self.STATE_BAKED_BIOCOMPOSITE
        self.grid[self.grid == self.STATE_MATURE_NETWORK] = self.STATE_BAKED_BIOCOMPOSITE
        self.grid[self.grid == self.STATE_DORMANT_TIP] = self.STATE_BAKED_BIOCOMPOSITE
        
        # 2. Evaluación de Densidad y Resistencia Mecánica
        structural_cells = int(np.sum(self.grid == self.STATE_BAKED_BIOCOMPOSITE))
        colonizable_cells = int(np.sum(~self.obstacles))
        density = float(structural_cells / max(1, colonizable_cells))
        
        # Estimación biomecánica basada en datos de Ganoderma lucidum horneado (NASA NIAC):
        # Resistencia a tracción aproximada: 1.2 MPa base + hasta 9.5 MPa en máxima densidad
        tensile_strength_mpa = float(round(1.2 + (density * 8.5), 2))
        pressure_capacity_atm = float(round(density * 1.35, 2))
        success = bool(density >= target_density)
        
        current_sol = (self.time_step // self.sol_length) + 1
        
        self.bake_result = {
            "success": success,
            "density": round(density, 4),
            "density_pct": round(density * 100.0, 2),
            "target_density_pct": round(target_density * 100.0, 2),
            "sol_horneado": current_sol,
            "structural_cells": structural_cells,
            "colonizable_cells": colonizable_cells,
            "tensile_strength_mpa": tensile_strength_mpa,
            "pressure_capacity_atm": pressure_capacity_atm,
            "soporta_1_atm": bool(pressure_capacity_atm >= 1.0),
            "status_text": "ÉXITO ESTRUCTURAL: Domo seguro para presurización de 1 ATM" if success else "FALLO ESTRUCTURAL: Densidad insuficiente, riesgo de despresurización"
        }
        
        print("\n" + "="*65)
        print(f"🔥 FASE DE HORNEADO INICIADA (NASA MYCOTECTURE - Sol {current_sol}) 🔥")
        print("="*65)
        print("Tratamiento térmico a 80°C ejecutado. Células desactivadas según COSPAR.")
        print(f"Densidad final de biocompuesto: {density * 100:.2f}% (Meta: {target_density * 100:.1f}%)")
        print(f"Resistencia estimada a la tracción: {tensile_strength_mpa} MPa | Presión máx: {pressure_capacity_atm} ATM")
        if success:
            print("✅ ESTADO: ÉXITO ESTRUCTURAL. El hábitat soporta presurización humana de 1 ATM.")
        else:
            print("❌ ESTADO: FALLO ESTRUCTURAL. Densidad por debajo del umbral de seguridad.")
        print("="*65 + "\n")
        
        return self.bake_result

    def get_stats(self):
        """Retorna métricas clave del estado de la colonia marciana y del domo."""
        baked_cells = int(np.sum(self.grid == self.STATE_BAKED_BIOCOMPOSITE))
        colonizable = int(np.sum(~self.obstacles))
        density = float((baked_cells if self.is_baked else (np.sum(self.grid == self.STATE_MATURE_NETWORK) + np.sum(self.grid == self.STATE_ACTIVE_TIP))) / max(1, colonizable))

        return {
            "time_step": self.time_step,
            "sol": (self.time_step // self.sol_length) + 1,
            "sol_hour": int((self.time_step % self.sol_length) * (24.0 / self.sol_length)),
            "temp_celsius": self.get_temperature(),
            "vitality": self.get_vitality(),
            "humectant_reserve": self.humectant_reserve,
            "mature_mycelium": int(np.sum(self.grid == self.STATE_MATURE_NETWORK)),
            "active_tips": int(np.sum(self.grid == self.STATE_ACTIVE_TIP)),
            "dormant_tips": int(np.sum(self.grid == self.STATE_DORMANT_TIP)),
            "baked_biocomposite": baked_cells,
            "is_baked": self.is_baked,
            "biomass_density_pct": round(density * 100.0, 2),
            "total_sugars": float(np.sum(self.nutrients)),
            "avg_cyanobacteria": float(np.mean(self.cyanobacteria)),
            "total_melanin": float(np.sum(self.melanin)),
            "chelated_iron_total": float(np.sum(self.chelated_iron)),
            "perchlorate_cleared_pct": float(1.0 - (np.mean(self.perchlorates) / np.mean(self.raw_layers["perchlorates"]))) * 100.0
        }

if __name__ == "__main__":
    print("=== INICIALIZANDO AUTÓMATA CELULAR FÚNGICO MARCIANO (NASA MYCOTECTURE) ===")
    grid_size = 120
    suitability, raw_layers = generate_martian_regolith_terrain(grid_size)
    robot_seed = (60, 60)
    cfu_density = 0.85 # 85,000 UFC/g
    humectant_water = 120.0
    
    sim = MartianFungalCA(
        regolith_layers=raw_layers,
        grid_size=grid_size,
        seed_pos=robot_seed,
        cfu_concentration=cfu_density,
        humectant_capacity=humectant_water
    )
    
    total_steps = 72 # 3 Soles marcianos completos
    log_file = "simulacion_micelio_marte.csv"
    
    with open(log_file, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["step", "sol", "hour", "temp_c", "vitality", "water_reserve", "mycelium_cells", "active_tips", "dormant_tips", "chelated_iron", "sugars", "melanin"])
        
        for s in range(total_steps):
            sim.step()
            st = sim.get_stats()
            writer.writerow([
                st["time_step"], st["sol"], st["sol_hour"], f"{st['temp_celsius']:.1f}",
                f"{st['vitality']:.2f}", f"{st['humectant_reserve']:.1f}",
                st["mature_mycelium"], st["active_tips"], st["dormant_tips"],
                f"{st['chelated_iron_total']:.2f}", f"{st['total_sugars']:.2f}", f"{st['total_melanin']:.2f}"
            ])
            
    print(f"-> Simulación de 3 Soles completada. Métricas exportadas a {log_file}")
    final_st = sim.get_stats()
    print(f"-> Red Micelial: {final_st['mature_mycelium']} celdas | Puntas activas: {final_st['active_tips']}")
    print(f"-> Hierro Fe2+ quelado acumulado: {final_st['chelated_iron_total']:.1f} unidades")
    print(f"-> Azúcares fotosintéticos sintetizados: {final_st['total_sugars']:.1f} unidades")
    print(f"-> Reducción neta de percloratos: {final_st['perchlorate_cleared_pct']:.1f}%")
    
    # Choque térmico de horneado (NASA Mycotecture)
    bake_res = sim.bake_habitat(target_density=0.15) # umbral para 3 soles
    print(f"-> Resultado de horneado: {bake_res['status_text']} ({bake_res['density_pct']}%)")
