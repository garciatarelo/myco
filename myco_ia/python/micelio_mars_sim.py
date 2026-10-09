import pygame
import sys
import numpy as np
from main_mars import MartianFungalCA, generate_martian_regolith_terrain

# ==============================================================================
# CONFIGURACIÓN DE PANTALLA Y ENTORNO MARCIANO
# ==============================================================================
GRID_SIZE = 120
CELL_SIZE = 6          # 120 * 6 = 720 px de cuadrícula
PANEL_HEIGHT = 150     # Panel inferior expandido para controles del traje espacial y telemetría de Marte

SCREEN_WIDTH = GRID_SIZE * CELL_SIZE
SCREEN_HEIGHT = (GRID_SIZE * CELL_SIZE) + PANEL_HEIGHT

# Paleta Bioquímica de Marte (Autómata Celular)
COLOR_BG = (22, 14, 11)              # Regolito marciano virgen seco (#160e0b) (0)
COLOR_OASIS = (14, 60, 92)           # Oasis hidratado viable (#0e3c5c) (1)
COLOR_HYPHA_TIP = (255, 69, 0)       # Punta de hifa activa diurna (#ff4500) (2)
COLOR_MYCELIUM = (0, 255, 204)       # Red de micelio madura (#00ffcc) (3)
COLOR_OBSTACLE = (50, 48, 46)        # Roca basáltica / pendiente extrema (#32302e) (4)
COLOR_DORMANT_TIP = (147, 197, 253)  # Punta en dormancia crioprotegida nocturna (#93c5fd) (5)
COLOR_BAKED = (195, 120, 65)         # Biocompuesto estructural horneado 80°C (#c37841 - Ladrillo Biológico) (6)

COLOR_PANEL = (13, 10, 14)
COLOR_PANEL_BORDER = (45, 30, 28)
COLOR_TEXT = (235, 230, 225)
COLOR_TEXT_DIM = (160, 145, 140)
COLOR_INJECTION = (245, 158, 11)     # Ámbar biocápsula

PALETTE = {
    MartianFungalCA.STATE_RAW_REGOLITH: COLOR_BG,
    MartianFungalCA.STATE_HYDRATED_OASIS: COLOR_OASIS,
    MartianFungalCA.STATE_ACTIVE_TIP: COLOR_HYPHA_TIP,
    MartianFungalCA.STATE_MATURE_NETWORK: COLOR_MYCELIUM,
    MartianFungalCA.STATE_OBSTACLE: COLOR_OBSTACLE,
    MartianFungalCA.STATE_DORMANT_TIP: COLOR_DORMANT_TIP,
    MartianFungalCA.STATE_BAKED_BIOCOMPOSITE: COLOR_BAKED
}

# Modos de Heatmap disponibles al presionar 'C'
HEATMAP_MODES = [
    "OFF",            # Vista del autómata celular estándar
    "HYDRATION",      # Difusión Fickiana del Hidrogel (Oasis de Humectante)
    "SUGARS",         # Azúcares generados por fotosíntesis (Glucosa simbiótica)
    "CYANOBACTERIA",  # Distribución de biomasa de Cianobacterias
    "PERCHLORATES",   # Toxicidad por Percloratos y ROS (ClO4-)
    "SIDEROPHORES",   # Quelación de Hierro Fe2+ y Sideróforos
    "IRON_OXIDES"     # Óxidos de Hierro Basales (Fe3+ / Regolito)
]

def value_to_colormap(val, cmap_type="blues"):
    """Mapea un valor normalizado [0, 1] a colores RGB según la capa biogeoquímica."""
    val = float(np.clip(val, 0.0, 1.0))
    if cmap_type == "blues": # Difusión de Agua / Hidrogel
        return (int(10 + 30 * val), int(35 + 155 * val), int(75 + 180 * val))
    elif cmap_type == "purples": # Toxicidad por Percloratos
        return (int(45 + 175 * val), int(15 + 40 * val), int(70 + 170 * val))
    elif cmap_type == "gold": # Sideróforos y Fe2+ quelado asimilable
        return (int(40 + 215 * val), int(30 + 165 * val), int(10 + 30 * val))
    elif cmap_type == "rust": # Óxidos de hierro basales
        return (int(50 + 170 * val), int(20 + 40 * val), int(15 + 25 * val))
    elif cmap_type == "greens": # Cianobacterias fotosintéticas
        return (int(10 + 25 * val), int(45 + 185 * val), int(25 + 90 * val))
    elif cmap_type == "amber": # Azúcares fotosintéticos (glucosa)
        return (int(70 + 185 * val), int(40 + 160 * val), int(10 + 35 * val))
    return (int(255 * val), int(255 * val), int(255 * val))

def precompute_martian_heatmaps(sim):
    """Genera superficies semitransparentes para cada capa de telemetría de Marte."""
    heatmaps = {}
    
    # 1. Hidratación / Oasis Fickiano
    s_h = pygame.Surface((GRID_SIZE * CELL_SIZE, GRID_SIZE * CELL_SIZE), pygame.SRCALPHA)
    for y in range(GRID_SIZE):
        for x in range(GRID_SIZE):
            v = sim.hydration[y, x]
            if v > 0.02:
                r, g, b = value_to_colormap(v, "blues")
                rect = (x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
                pygame.draw.rect(s_h, (r, g, b, 195), rect)
    heatmaps["HYDRATION"] = s_h

    # 2. Azúcares generados por fotosíntesis (Simbiosis NASA)
    s_sug = pygame.Surface((GRID_SIZE * CELL_SIZE, GRID_SIZE * CELL_SIZE), pygame.SRCALPHA)
    for y in range(GRID_SIZE):
        for x in range(GRID_SIZE):
            v = sim.nutrients[y, x]
            if v > 0.01:
                r, g, b = value_to_colormap(v, "amber")
                rect = (x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
                pygame.draw.rect(s_sug, (r, g, b, 190), rect)
    heatmaps["SUGARS"] = s_sug

    # 3. Cianobacterias fotosintéticas
    s_cyano = pygame.Surface((GRID_SIZE * CELL_SIZE, GRID_SIZE * CELL_SIZE), pygame.SRCALPHA)
    for y in range(GRID_SIZE):
        for x in range(GRID_SIZE):
            v = sim.cyanobacteria[y, x]
            if v > 0.05:
                r, g, b = value_to_colormap(v, "greens")
                rect = (x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
                pygame.draw.rect(s_cyano, (r, g, b, 175), rect)
    heatmaps["CYANOBACTERIA"] = s_cyano

    # 4. Percloratos y ROS
    s_p = pygame.Surface((GRID_SIZE * CELL_SIZE, GRID_SIZE * CELL_SIZE), pygame.SRCALPHA)
    for y in range(GRID_SIZE):
        for x in range(GRID_SIZE):
            v = sim.perchlorates[y, x]
            r, g, b = value_to_colormap(v, "purples")
            rect = (x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
            pygame.draw.rect(s_p, (r, g, b, 175), rect)
    heatmaps["PERCHLORATES"] = s_p

    # 5. Sideróforos y Hierro Fe2+ quelado
    s_s = pygame.Surface((GRID_SIZE * CELL_SIZE, GRID_SIZE * CELL_SIZE), pygame.SRCALPHA)
    fe_sum = np.clip(sim.chelated_iron + sim.siderophores * 0.5, 0.0, 1.0)
    for y in range(GRID_SIZE):
        for x in range(GRID_SIZE):
            v = fe_sum[y, x]
            if v > 0.01:
                r, g, b = value_to_colormap(v, "gold")
                rect = (x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
                pygame.draw.rect(s_s, (r, g, b, 200), rect)
    heatmaps["SIDEROPHORES"] = s_s

    # 6. Óxidos de hierro basales
    s_fe = pygame.Surface((GRID_SIZE * CELL_SIZE, GRID_SIZE * CELL_SIZE), pygame.SRCALPHA)
    for y in range(GRID_SIZE):
        for x in range(GRID_SIZE):
            v = sim.iron_oxides[y, x]
            r, g, b = value_to_colormap(v, "rust")
            rect = (x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
            pygame.draw.rect(s_fe, (r, g, b, 180), rect)
    heatmaps["IRON_OXIDES"] = s_fe

    return heatmaps

def create_martian_simulation(seed_pos=(60, 60), cfu_concentration=0.85, humectant_capacity=120.0):
    suitability, raw_layers = generate_martian_regolith_terrain(GRID_SIZE)
    sim = MartianFungalCA(
        regolith_layers=raw_layers,
        grid_size=GRID_SIZE,
        seed_pos=seed_pos,
        cfu_concentration=cfu_concentration,
        humectant_capacity=humectant_capacity
    )
    heatmaps = precompute_martian_heatmaps(sim)
    return sim, raw_layers, heatmaps

def cfu_to_vigor(cfu_val, min_val=10000, max_val=100000):
    clamped = max(min_val, min(max_val, cfu_val))
    return 0.1 + (clamped - min_val) / (max_val - min_val) * 0.9

def main():
    pygame.init()
    pygame.font.init()
    
    screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
    pygame.display.set_caption("Myco AI - Laboratorio de Traje Espacial Marciano: Astrobiología y Sideróforos")
    clock = pygame.time.Clock()
    
    font_main = pygame.font.SysFont("Arial", 14, bold=True)
    font_sub = pygame.font.SysFont("Arial", 12)
    font_code = pygame.font.SysFont("Courier New", 12, bold=True)

    # Parámetros del Traje Espacial (Biocápsula de Hidrogel)
    MIN_CFU = 10000
    MAX_CFU = 100000
    current_cfu = 85000
    cfu_vigor = cfu_to_vigor(current_cfu, MIN_CFU, MAX_CFU)
    humectant_water = 120.0 # Reserva de hidrogel de alginato + glicerol

    robot_injection_point = (60, 60)
    sim, raw_layers, heatmaps = create_martian_simulation(
        robot_injection_point, 
        cfu_concentration=cfu_vigor,
        humectant_capacity=humectant_water
    )
    
    step_count = 0
    paused = False
    target_fps = 18
    heatmap_idx = 0

    # Coordenadas de Controles Interactivos
    panel_top = GRID_SIZE * CELL_SIZE
    
    # Slider de UFC/g
    slider_cfu_rect = pygame.Rect(115, panel_top + 60, 140, 12)
    input_cfu_rect = pygame.Rect(265, panel_top + 55, 75, 22)
    
    # Slider de Reserva de Hidrogel (Humectant Capacity)
    slider_gel_rect = pygame.Rect(485, panel_top + 60, 130, 12)
    
    slider_cfu_dragging = False
    slider_gel_dragging = False
    input_text = str(current_cfu)
    input_active = False

    grid_surface = pygame.Surface((GRID_SIZE * CELL_SIZE, GRID_SIZE * CELL_SIZE))

    running = True
    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
                
            elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
                mx, my = event.pos
                
                # 1. Clic dentro del terreno marciano: Inocular nueva biocápsula ("Traje Espacial")
                if my < panel_top:
                    input_active = False
                    gx, gy = mx // CELL_SIZE, my // CELL_SIZE
                    if 0 <= gx < GRID_SIZE and 0 <= gy < GRID_SIZE:
                        if not sim.obstacles[gy, gx]:
                            sim.inoculate((gx, gy), cfu_concentration=cfu_vigor, humectant_capacity=humectant_water)
                            robot_injection_point = (gx, gy)
                
                # 2. Clic en input de texto UFC
                elif input_cfu_rect.collidepoint(mx, my):
                    input_active = True
                    slider_cfu_dragging = False
                    slider_gel_dragging = False
                
                # 3. Clic en slider UFC
                elif slider_cfu_rect.inflate(10, 14).collidepoint(mx, my):
                    input_active = False
                    slider_cfu_dragging = True
                    slider_gel_dragging = False
                    ratio = max(0.0, min(1.0, (mx - slider_cfu_rect.x) / slider_cfu_rect.width))
                    current_cfu = int(MIN_CFU + ratio * (MAX_CFU - MIN_CFU))
                    current_cfu = int(round(current_cfu / 1000) * 1000)
                    cfu_vigor = cfu_to_vigor(current_cfu, MIN_CFU, MAX_CFU)
                    input_text = str(current_cfu)
                    sim.cfu_vigor = cfu_vigor
                
                # 4. Clic en slider de Hidrogel
                elif slider_gel_rect.inflate(10, 14).collidepoint(mx, my):
                    input_active = False
                    slider_gel_dragging = True
                    slider_cfu_dragging = False
                    ratio = max(0.0, min(1.0, (mx - slider_gel_rect.x) / slider_gel_rect.width))
                    humectant_water = float(30.0 + ratio * (200.0 - 30.0))
                    sim.humectant_reserve = humectant_water
                
                else:
                    if input_active:
                        input_active = False
                        try:
                            val = int(input_text)
                            current_cfu = max(MIN_CFU, min(MAX_CFU, val))
                        except ValueError:
                            pass
                        input_text = str(current_cfu)
                        cfu_vigor = cfu_to_vigor(current_cfu, MIN_CFU, MAX_CFU)
                        sim.cfu_vigor = cfu_vigor

            elif event.type == pygame.MOUSEBUTTONUP and event.button == 1:
                slider_cfu_dragging = False
                slider_gel_dragging = False

            elif event.type == pygame.MOUSEMOTION:
                if slider_cfu_dragging:
                    mx, my = event.pos
                    ratio = max(0.0, min(1.0, (mx - slider_cfu_rect.x) / slider_cfu_rect.width))
                    current_cfu = int(MIN_CFU + ratio * (MAX_CFU - MIN_CFU))
                    current_cfu = int(round(current_cfu / 1000) * 1000)
                    cfu_vigor = cfu_to_vigor(current_cfu, MIN_CFU, MAX_CFU)
                    input_text = str(current_cfu)
                    sim.cfu_vigor = cfu_vigor
                elif slider_gel_dragging:
                    mx, my = event.pos
                    ratio = max(0.0, min(1.0, (mx - slider_gel_rect.x) / slider_gel_rect.width))
                    humectant_water = float(30.0 + ratio * (200.0 - 30.0))
                    sim.humectant_reserve = humectant_water

            elif event.type == pygame.KEYDOWN:
                if input_active:
                    if event.key in (pygame.K_RETURN, pygame.K_KP_ENTER):
                        input_active = False
                        try:
                            val = int(input_text)
                            current_cfu = max(MIN_CFU, min(MAX_CFU, val))
                        except ValueError:
                            pass
                        input_text = str(current_cfu)
                        cfu_vigor = cfu_to_vigor(current_cfu, MIN_CFU, MAX_CFU)
                        sim.cfu_vigor = cfu_vigor
                    elif event.key == pygame.K_BACKSPACE:
                        input_text = input_text[:-1]
                    elif event.unicode.isdigit() and len(input_text) < 6:
                        input_text += event.unicode
                        try:
                            val = int(input_text)
                            if MIN_CFU <= val <= MAX_CFU:
                                current_cfu = val
                                cfu_vigor = cfu_to_vigor(current_cfu, MIN_CFU, MAX_CFU)
                                sim.cfu_vigor = cfu_vigor
                        except ValueError:
                            pass
                    elif event.key == pygame.K_ESCAPE:
                        input_active = False
                        input_text = str(current_cfu)
                else:
                    if event.key == pygame.K_ESCAPE:
                        running = False
                    elif event.key == pygame.K_SPACE:
                        paused = not paused
                    elif event.key == pygame.K_r:
                        sim, raw_layers, heatmaps = create_martian_simulation(
                            robot_injection_point, 
                            cfu_concentration=cfu_vigor,
                            humectant_capacity=humectant_water
                        )
                        step_count = 0
                    elif event.key == pygame.K_c:
                        heatmap_idx = (heatmap_idx + 1) % len(HEATMAP_MODES)
                    elif event.key == pygame.K_b:
                        # Choque térmico de Horneado (NASA Mycotecture)
                        sim.bake_habitat(target_density=0.70)
                        heatmaps = precompute_martian_heatmaps(sim)
                    elif event.key == pygame.K_UP:
                        target_fps = min(60, target_fps + 4)
                    elif event.key == pygame.K_DOWN:
                        target_fps = max(1, target_fps - 4)
                    elif event.key == pygame.K_RIGHT and paused:
                        sim.step()
                        step_count += 1
                        heatmaps = precompute_martian_heatmaps(sim)

        # Actualizar simulación si no está pausada ni horneada
        active_and_dormant = int(np.sum((sim.grid == 2) | (sim.grid == 5)))
        if not paused and not sim.is_baked and (active_and_dormant > 0 or sim.humectant_reserve > 0):
            sim.step()
            step_count += 1
            # Recomputar mapas de calor cada 3 pasos para fluidez
            if step_count % 3 == 0:
                heatmaps = precompute_martian_heatmaps(sim)

        # 1. Render de Celosía del Autómata Marciano
        grid_surface.fill(COLOR_BG)
        for y in range(GRID_SIZE):
            for x in range(GRID_SIZE):
                val = sim.grid[y, x]
                if val != 0:
                    rect = (x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
                    pygame.draw.rect(grid_surface, PALETTE.get(val, COLOR_BG), rect)

        screen.blit(grid_surface, (0, 0))

        # 2. Render de Capas de Heatmap si están activas
        current_mode = HEATMAP_MODES[heatmap_idx]
        if current_mode != "OFF":
            screen.blit(heatmaps[current_mode], (0, 0))
            
            # Re-dibujar micelio y biocompuesto por encima
            overlay_tips = pygame.Surface((GRID_SIZE * CELL_SIZE, GRID_SIZE * CELL_SIZE), pygame.SRCALPHA)
            for y in range(GRID_SIZE):
                for x in range(GRID_SIZE):
                    val = sim.grid[y, x]
                    if val in (2, 3, 5, 6):
                        rect = (x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
                        color = PALETTE.get(val, COLOR_MYCELIUM)
                        pygame.draw.rect(overlay_tips, (*color, 240), rect)
            screen.blit(overlay_tips, (0, 0))

        # Resaltar Epicentro del Traje Espacial con halo de Alginato
        ix, iy = robot_injection_point
        initial_rad = int(np.floor(sim.cfu_vigor * 2.8))
        circle_px = max(CELL_SIZE + 4, (initial_rad + 2) * CELL_SIZE)
        pygame.draw.circle(
            screen, 
            COLOR_INJECTION, 
            (ix * CELL_SIZE + CELL_SIZE // 2, iy * CELL_SIZE + CELL_SIZE // 2), 
            circle_px, 
            2
        )

        # 3. Panel de Instrumentación y Telemetría Marciana
        panel_rect = pygame.Rect(0, panel_top, SCREEN_WIDTH, PANEL_HEIGHT)
        pygame.draw.rect(screen, COLOR_PANEL, panel_rect)
        pygame.draw.line(screen, COLOR_PANEL_BORDER, (0, panel_top), (SCREEN_WIDTH, panel_top), 2)

        stats = sim.get_stats()
        current_temp = stats["temp_celsius"]
        vitality = stats["vitality"]
        
        # Color y estado de la atmósfera y el domo
        if sim.is_baked:
            bake_info = sim.bake_result or {}
            success_str = "APTO 1 ATM" if bake_info.get("success") else "DENSIDAD INSUFICIENTE"
            thermal_state = f"🔥 DOMO HORNEADO (80°C - BIOCOMPUESTO ESTRUCTURAL) [{success_str}]"
            thermal_color = (249, 115, 22) # Naranja fuego
        elif vitality <= 0:
            thermal_state = "NOCHE MARCIANA (DORMANCIA CRIOPROTEGIDA -8°C)"
            thermal_color = (147, 197, 253) # Azul frío
        else:
            thermal_state = "DÍA MARCIANO (FOTOSÍNTESIS CIANOBACTERIAS + SIDERÓFOROS)"
            thermal_color = (52, 211, 153) # Verde vida

        # Cursor inspector
        mx, my = pygame.mouse.get_pos()
        hover_info = ""
        if my < panel_top:
            hx, hy = mx // CELL_SIZE, my // CELL_SIZE
            if 0 <= hx < GRID_SIZE and 0 <= hy < GRID_SIZE:
                h_pct = sim.hydration[hy, hx] * 100.0
                p_pct = sim.perchlorates[hy, hx] * 100.0
                fe_che = sim.chelated_iron[hy, hx]
                cy_pct = sim.cyanobacteria[hy, hx] * 100.0
                sug_pct = sim.nutrients[hy, hx] * 100.0
                hover_info = f"Regolito ({hx},{hy}): H={h_pct:.1f}% | Ciano={cy_pct:.0f}% | Azúcares={sug_pct:.0f}% | ClO4-={p_pct:.1f}% | Fe2+={fe_che:.2f}"

        # --- FILA 1: Reloj de Sol Marciano y Temperatura Térmica ---
        sol_str = f"SOL {stats['sol']} - {stats['sol_hour']:02d}:00 MST  |  Temp: {current_temp:+.1f}°C  |  Gel Alginato: {stats['humectant_reserve']:.1f}U  |  FPS: {target_fps}"
        text_sol = font_main.render(sol_str, True, COLOR_TEXT)
        text_therm = font_main.render(f"[{thermal_state}]", True, thermal_color)
        screen.blit(text_sol, (15, panel_top + 8))
        screen.blit(text_therm, (SCREEN_WIDTH - text_therm.get_width() - 15, panel_top + 8))

        # --- FILA 2: Telemetría de la Colonia, Azúcares Fotosintéticos y Densidad Estructural ---
        baked_badge = f"Biocompuesto: {stats['baked_biocomposite']} celdas" if sim.is_baked else f"Puntas: {stats['active_tips']} (Dorm: {stats['dormant_tips']})"
        colony_str = f"Hifas: {stats['mature_mycelium']}  |  {baked_badge}  |  Azúcares: {stats['total_sugars']:.0f} U  |  Densidad Domo: {stats['biomass_density_pct']:.1f}% (Meta 70%)  |  Fe2+: {stats['chelated_iron_total']:.1f}"
        text_colony = font_sub.render(colony_str, True, (251, 191, 36))
        screen.blit(text_colony, (15, panel_top + 31))

        # --- FILA 3: Controles del Traje Espacial (UFC/g e Hidrogel) ---
        # 1. Slider UFC
        lbl_cfu = font_main.render("Inóculo UFC/g:", True, (52, 211, 153))
        screen.blit(lbl_cfu, (15, panel_top + 57))
        
        pygame.draw.rect(screen, (30, 25, 28), slider_cfu_rect, border_radius=5)
        pct_cfu = max(0.0, min(1.0, (current_cfu - MIN_CFU) / (MAX_CFU - MIN_CFU)))
        fill_w_cfu = int(pct_cfu * slider_cfu_rect.width)
        if fill_w_cfu > 0:
            fill_rect_cfu = pygame.Rect(slider_cfu_rect.x, slider_cfu_rect.y, fill_w_cfu, slider_cfu_rect.height)
            pygame.draw.rect(screen, (16, 185, 129), fill_rect_cfu, border_radius=5)
        pygame.draw.rect(screen, (85, 65, 60), slider_cfu_rect, width=1, border_radius=5)
        
        thumb_cfu_x = slider_cfu_rect.x + fill_w_cfu
        thumb_cfu_y = slider_cfu_rect.y + slider_cfu_rect.height // 2
        pygame.draw.circle(screen, (255, 255, 255) if slider_cfu_dragging else (52, 211, 153), (thumb_cfu_x, thumb_cfu_y), 7)

        # Input Box UFC
        box_bg = (18, 14, 16) if not input_active else (30, 22, 26)
        pygame.draw.rect(screen, box_bg, input_cfu_rect, border_radius=4)
        pygame.draw.rect(screen, (56, 189, 248) if input_active else (85, 65, 60), input_cfu_rect, width=2 if input_active else 1, border_radius=4)
        txt_cfu_surface = font_code.render(input_text, True, (241, 245, 249))
        ty = input_cfu_rect.y + (input_cfu_rect.height - txt_cfu_surface.get_height()) // 2
        screen.blit(txt_cfu_surface, (input_cfu_rect.x + 5, ty))
        
        txt_unit = font_sub.render("UFC/g", True, COLOR_TEXT_DIM)
        screen.blit(txt_unit, (input_cfu_rect.right + 4, panel_top + 58))

        # 2. Slider Hidrogel (Alginato + Glicerol)
        lbl_gel = font_main.render("Capacidad Alginato:", True, (56, 189, 248))
        screen.blit(lbl_gel, (input_cfu_rect.right + 45, panel_top + 57))
        
        pygame.draw.rect(screen, (20, 28, 38), slider_gel_rect, border_radius=5)
        pct_gel = max(0.0, min(1.0, (humectant_water - 30.0) / (200.0 - 30.0)))
        fill_w_gel = int(pct_gel * slider_gel_rect.width)
        if fill_w_gel > 0:
            fill_rect_gel = pygame.Rect(slider_gel_rect.x, slider_gel_rect.y, fill_w_gel, slider_gel_rect.height)
            pygame.draw.rect(screen, (14, 165, 233), fill_rect_gel, border_radius=5)
        pygame.draw.rect(screen, (60, 85, 110), slider_gel_rect, width=1, border_radius=5)
        
        thumb_gel_x = slider_gel_rect.x + fill_w_gel
        thumb_gel_y = slider_gel_rect.y + slider_gel_rect.height // 2
        pygame.draw.circle(screen, (255, 255, 255) if slider_gel_dragging else (56, 189, 248), (thumb_gel_x, thumb_gel_y), 7)
        
        txt_gel_val = font_sub.render(f"{humectant_water:.0f} U", True, (125, 211, 252))
        screen.blit(txt_gel_val, (slider_gel_rect.right + 8, panel_top + 58))

        # --- FILA 4: Hover Sensor y Capas Ambientales ---
        if hover_info:
            text_sensor = font_sub.render(hover_info, True, (130, 210, 255))
            screen.blit(text_sensor, (15, panel_top + 85))
        else:
            text_sensor = font_sub.render("Pasa el mouse sobre el domo para inspeccionar hidratación, fotosíntesis, cianobacterias y percloratos", True, COLOR_TEXT_DIM)
            screen.blit(text_sensor, (15, panel_top + 85))

        # --- FILA 5: Controles de Teclado, Horneado y Modo Heatmap ---
        mode_labels = {
            "OFF": "Estándar Celular (Paleta Marciana)",
            "HYDRATION": "Oasis Hidrogel (Difusión Fick)",
            "SUGARS": "Azúcares Fotosintéticos (Glucosa)",
            "CYANOBACTERIA": "Biomasa Cianobacterias",
            "PERCHLORATES": "Toxicidad Percloratos (ClO4-)",
            "SIDEROPHORES": "Hierro Fe2+ y Sideróforos",
            "IRON_OXIDES": "Óxidos de Hierro Fe3+"
        }
        heatmap_text = f"Capa [C]: {mode_labels.get(current_mode, current_mode)}"
        text_hm = font_sub.render(heatmap_text, True, (255, 215, 0) if current_mode != "OFF" else COLOR_TEXT_DIM)
        controls_str = "[Espacio] Pausa  |  [B] Hornear Domo (80°C NASA)  |  [C] Capas  |  [R] Reset  |  [Clic] Inocular"
        text_ctrl = font_sub.render(controls_str, True, (244, 114, 182) if sim.is_baked else COLOR_TEXT_DIM)
        
        screen.blit(text_hm, (15, panel_top + 110))
        screen.blit(text_ctrl, (SCREEN_WIDTH - text_ctrl.get_width() - 15, panel_top + 110))

        pygame.display.flip()
        clock.tick(target_fps)

    pygame.quit()
    sys.exit()

if __name__ == "__main__":
    main()
