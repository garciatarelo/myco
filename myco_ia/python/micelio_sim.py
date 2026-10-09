import pygame
import sys
import numpy as np
from main import FungalSoilMeasurementCA
from normalizer import generate_multi_sensor_terrain, normalize_soil_parameters

# Configuración de resolución y cuadrícula
GRID_SIZE = 120
CELL_SIZE = 6          # 120 * 6 = 720 px de cuadrícula
PANEL_HEIGHT = 120     # Panel inferior expandido para controles de UFC/g, sensores y estadísticas

SCREEN_WIDTH = GRID_SIZE * CELL_SIZE
SCREEN_HEIGHT = (GRID_SIZE * CELL_SIZE) + PANEL_HEIGHT

# Paleta base de autómata celular
COLOR_BG = (17, 17, 17)            # Suelo virgen (0)
COLOR_MEASURED = (45, 55, 72)      # Suelo medido / potencial (#2d3748) (1)
COLOR_HYPHA_TIP = (255, 69, 0)     # Punta activa (#ff4500) (2)
COLOR_MYCELIUM = (0, 255, 204)     # Red de micelio (#00ffcc) (3)
COLOR_OBSTACLE = (51, 51, 51)      # Obstáculos / roca / ultra-compactado (#333333) (4)

COLOR_PANEL = (11, 15, 25)
COLOR_TEXT = (220, 225, 235)
COLOR_TEXT_DIM = (140, 145, 160)
COLOR_INJECTION = (76, 175, 80)    # Verde punto de inoculación

PALETTE = {
    0: COLOR_BG,
    1: COLOR_MEASURED,
    2: COLOR_HYPHA_TIP,
    3: COLOR_MYCELIUM,
    4: COLOR_OBSTACLE
}

# Modos de Heatmap disponibles al presionar 'C'
HEATMAP_MODES = [
    "OFF",           # Sin heatmap (vista estándar CA)
    "COMPOSITE",     # Índice compuesto normalizado (0.0 a 1.0)
    "ORGANIC",       # Materia Orgánica / Nutrientes (%)
    "MOISTURE",      # Humedad (%)
    "COMPACTION"     # Compactación (MPa)
]

def value_to_colormap(val, cmap_type="inferno"):
    """Mapea un valor normalizado [0, 1] a RGB."""
    val = float(np.clip(val, 0.0, 1.0))
    if cmap_type == "inferno":
        # Gradiente negro -> púrpura -> naranja -> amarillo brillante
        if val < 0.33:
            t = val / 0.33
            return (int(10 + 60 * t), int(5 + 10 * t), int(30 + 90 * t))
        elif val < 0.66:
            t = (val - 0.33) / 0.33
            return (int(70 + 155 * t), int(15 + 65 * t), int(120 - 90 * t))
        else:
            t = (val - 0.66) / 0.34
            return (int(225 + 30 * t), int(80 + 175 * t), int(30 + 150 * t))
    elif cmap_type == "greens": # Para nutrientes / MO
        return (int(20 + 40 * val), int(30 + 210 * val), int(30 + 60 * val))
    elif cmap_type == "blues":  # Para humedad
        return (int(15 + 40 * val), int(40 + 130 * val), int(70 + 185 * val))
    elif cmap_type == "reds":   # Para compactación
        return (int(50 + 205 * val), int(25 + 40 * val), int(25 + 30 * val))
    return (int(255 * val), int(255 * val), int(255 * val))

def precompute_heatmaps(terrain_map, raw_sensors):
    """Genera superficies semitransparentes para cada mapa de calor."""
    heatmaps = {}
    
    # 1. Composite Suitability (0.0 a 1.0)
    s_comp = pygame.Surface((GRID_SIZE * CELL_SIZE, GRID_SIZE * CELL_SIZE), pygame.SRCALPHA)
    for y in range(GRID_SIZE):
        for x in range(GRID_SIZE):
            v = terrain_map[y, x]
            r, g, b = value_to_colormap(v, "inferno")
            rect = (x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
            pygame.draw.rect(s_comp, (r, g, b, 185), rect)
    heatmaps["COMPOSITE"] = s_comp

    # 2. Materia Orgánica (0.0% a 5.0%)
    s_org = pygame.Surface((GRID_SIZE * CELL_SIZE, GRID_SIZE * CELL_SIZE), pygame.SRCALPHA)
    mo_grid = np.clip(raw_sensors["organic_matter"] / 5.0, 0.0, 1.0)
    for y in range(GRID_SIZE):
        for x in range(GRID_SIZE):
            v = mo_grid[y, x]
            r, g, b = value_to_colormap(v, "greens")
            rect = (x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
            pygame.draw.rect(s_org, (r, g, b, 185), rect)
    heatmaps["ORGANIC"] = s_org

    # 3. Humedad (0.0% a 100.0%)
    s_moist = pygame.Surface((GRID_SIZE * CELL_SIZE, GRID_SIZE * CELL_SIZE), pygame.SRCALPHA)
    moist_grid = np.clip(raw_sensors["moisture"] / 100.0, 0.0, 1.0)
    for y in range(GRID_SIZE):
        for x in range(GRID_SIZE):
            v = moist_grid[y, x]
            r, g, b = value_to_colormap(v, "blues")
            rect = (x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
            pygame.draw.rect(s_moist, (r, g, b, 185), rect)
    heatmaps["MOISTURE"] = s_moist

    # 4. Compactación (0.5 a 3.5 MPa)
    s_compaction = pygame.Surface((GRID_SIZE * CELL_SIZE, GRID_SIZE * CELL_SIZE), pygame.SRCALPHA)
    comp_norm = np.clip((raw_sensors["compaction"] - 0.5) / (3.5 - 0.5), 0.0, 1.0)
    for y in range(GRID_SIZE):
        for x in range(GRID_SIZE):
            v = comp_norm[y, x]
            r, g, b = value_to_colormap(v, "reds")
            rect = (x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
            pygame.draw.rect(s_compaction, (r, g, b, 185), rect)
    heatmaps["COMPACTION"] = s_compaction

    return heatmaps

def create_simulation(seed_pos=(10, 10), cfu_concentration=0.5):
    terrain_map, raw_sensors = generate_multi_sensor_terrain(GRID_SIZE)
    sim = FungalSoilMeasurementCA(
        soil_measurements=terrain_map, 
        seed_pos=seed_pos, 
        cfu_concentration=cfu_concentration
    )
    heatmaps = precompute_heatmaps(terrain_map, raw_sensors)
    return sim, terrain_map, raw_sensors, heatmaps

def cfu_to_vigor(cfu_val, min_val=10000, max_val=100000):
    """Mapea concentración UFC/g a vigor normalizado [0.1, 1.0]."""
    clamped = max(min_val, min(max_val, cfu_val))
    return 0.1 + (clamped - min_val) / (max_val - min_val) * 0.9

def main():
    pygame.init()
    pygame.font.init()
    
    screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
    pygame.display.set_caption("Myco AI - Simulación CA: Densidad UFC/g y Dinámica Micelial")
    clock = pygame.time.Clock()
    
    font_main = pygame.font.SysFont("Arial", 14, bold=True)
    font_sub = pygame.font.SysFont("Arial", 12)
    font_code = pygame.font.SysFont("Courier New", 12, bold=True)

    # Parámetros biológicos de concentración UFC/g
    MIN_CFU = 10000
    MAX_CFU = 100000
    current_cfu = 50000
    cfu_vigor = cfu_to_vigor(current_cfu, MIN_CFU, MAX_CFU)

    robot_injection_point = (10, 10)
    sim, terrain_map, raw_sensors, heatmaps = create_simulation(
        robot_injection_point, 
        cfu_concentration=cfu_vigor
    )
    
    step_count = 0
    paused = False
    target_fps = 20
    heatmap_idx = 0  # 0: OFF, 1: COMPOSITE, 2: ORGANIC, 3: MOISTURE, 4: COMPACTION

    # Estado de la interfaz de UFC/g
    panel_top = GRID_SIZE * CELL_SIZE
    slider_rect = pygame.Rect(135, panel_top + 60, 155, 12)
    input_box_rect = pygame.Rect(302, panel_top + 55, 78, 22)
    
    slider_dragging = False
    input_text = str(current_cfu)
    input_active = False

    # Superficie específica para renderizar las celdas del autómata
    grid_surface = pygame.Surface((GRID_SIZE * CELL_SIZE, GRID_SIZE * CELL_SIZE))

    running = True
    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
                
            elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
                mx, my = event.pos
                
                # 1. Clic dentro del terreno: Inocular nueva espora con el vigor actual de UFC
                if my < panel_top:
                    input_active = False
                    gx, gy = mx // CELL_SIZE, my // CELL_SIZE
                    if 0 <= gx < GRID_SIZE and 0 <= gy < GRID_SIZE:
                        if sim.grid[gy, gx] != 4:  # Evitar rocas
                            sim.inoculate((gx, gy), cfu_concentration=cfu_vigor)
                            robot_injection_point = (gx, gy)
                
                # 2. Clic en el campo de texto de UFC
                elif input_box_rect.collidepoint(mx, my):
                    input_active = True
                    slider_dragging = False
                
                # 3. Clic en el slider de UFC
                elif slider_rect.inflate(12, 14).collidepoint(mx, my):
                    input_active = False
                    slider_dragging = True
                    # Calcular nuevo valor según la posición X
                    ratio = max(0.0, min(1.0, (mx - slider_rect.x) / slider_rect.width))
                    current_cfu = int(MIN_CFU + ratio * (MAX_CFU - MIN_CFU))
                    current_cfu = int(round(current_cfu / 1000) * 1000)  # Redondear a miles
                    cfu_vigor = cfu_to_vigor(current_cfu, MIN_CFU, MAX_CFU)
                    input_text = str(current_cfu)
                    sim.cfu_vigor = cfu_vigor
                
                # 4. Clic en cualquier otra zona: Desactivar input de texto y validar
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
                slider_dragging = False

            elif event.type == pygame.MOUSEMOTION:
                if slider_dragging:
                    mx, my = event.pos
                    ratio = max(0.0, min(1.0, (mx - slider_rect.x) / slider_rect.width))
                    current_cfu = int(MIN_CFU + ratio * (MAX_CFU - MIN_CFU))
                    current_cfu = int(round(current_cfu / 1000) * 1000)
                    cfu_vigor = cfu_to_vigor(current_cfu, MIN_CFU, MAX_CFU)
                    input_text = str(current_cfu)
                    sim.cfu_vigor = cfu_vigor

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
                    elif event.unicode.isdigit():
                        if len(input_text) < 6:  # Limitar hasta 6 dígitos
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
                        # Reiniciar simulación con nuevo terreno y conservar la densidad UFC
                        sim, terrain_map, raw_sensors, heatmaps = create_simulation(
                            robot_injection_point, 
                            cfu_concentration=cfu_vigor
                        )
                        step_count = 0
                    elif event.key == pygame.K_c:
                        # Conmutar capa de Heatmap superpuesta
                        heatmap_idx = (heatmap_idx + 1) % len(HEATMAP_MODES)
                    elif event.key == pygame.K_UP:
                        target_fps = min(60, target_fps + 5)
                    elif event.key == pygame.K_DOWN:
                        target_fps = max(1, target_fps - 5)
                    elif event.key == pygame.K_RIGHT and paused:
                        sim.step()
                        step_count += 1

        # Actualizar simulación si hay actividad y no está pausada
        active_tips = int(np.sum(sim.grid == 2))
        if not paused and active_tips > 0:
            sim.step()
            step_count += 1

        # 1. Dibujar cuadrícula base del autómata celular
        grid_surface.fill(COLOR_BG)
        for y in range(GRID_SIZE):
            for x in range(GRID_SIZE):
                val = sim.grid[y, x]
                if val != 0:
                    rect = (x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
                    pygame.draw.rect(grid_surface, PALETTE.get(val, COLOR_BG), rect)

        screen.blit(grid_surface, (0, 0))

        # 2. Dibujar capa de mapa de calor superpuesta si está activa
        current_mode = HEATMAP_MODES[heatmap_idx]
        if current_mode != "OFF":
            screen.blit(heatmaps[current_mode], (0, 0))
            
            # Re-dibujar micelio y puntas activas encima para que resalten sobre el mapa de calor
            overlay_tips = pygame.Surface((GRID_SIZE * CELL_SIZE, GRID_SIZE * CELL_SIZE), pygame.SRCALPHA)
            for y in range(GRID_SIZE):
                for x in range(GRID_SIZE):
                    val = sim.grid[y, x]
                    if val in (2, 3):  # Puntas de hifas y red micelial
                        rect = (x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
                        color = COLOR_HYPHA_TIP if val == 2 else COLOR_MYCELIUM
                        pygame.draw.rect(overlay_tips, (*color, 240), rect)
            screen.blit(overlay_tips, (0, 0))

        # Resaltar punto de inyección del robot con halo proporcional al radio de UFC
        ix, iy = robot_injection_point
        initial_rad = int(np.floor(sim.cfu_vigor * 2.5))
        circle_px = max(CELL_SIZE + 2, (initial_rad + 1) * CELL_SIZE)
        pygame.draw.circle(
            screen, 
            COLOR_INJECTION, 
            (ix * CELL_SIZE + CELL_SIZE // 2, iy * CELL_SIZE + CELL_SIZE // 2), 
            circle_px, 
            2
        )

        # 3. Panel inferior de información y controles
        panel_rect = pygame.Rect(0, panel_top, SCREEN_WIDTH, PANEL_HEIGHT)
        pygame.draw.rect(screen, COLOR_PANEL, panel_rect)
        pygame.draw.line(screen, (35, 45, 65), (0, panel_top), (SCREEN_WIDTH, panel_top), 2)

        mycelium_count = int(np.sum(sim.grid == 3))
        active_tips = int(np.sum(sim.grid == 2))
        status_text = "PAUSADO" if paused else ("FINALIZADO" if active_tips == 0 else "SIMULANDO")
        status_color = (255, 193, 7) if paused else ((0, 255, 204) if active_tips > 0 else (255, 87, 34))

        # Lectura de sensores bajo el cursor
        mx, my = pygame.mouse.get_pos()
        hover_info = ""
        if my < panel_top:
            hx, hy = mx // CELL_SIZE, my // CELL_SIZE
            if 0 <= hx < GRID_SIZE and 0 <= hy < GRID_SIZE:
                mo_v = raw_sensors["organic_matter"][hy, hx]
                h_v = raw_sensors["moisture"][hy, hx]
                c_v = raw_sensors["compaction"][hy, hx]
                s_v = terrain_map[hy, hx]
                hover_info = f"Cursor ({hx},{hy}): MO={mo_v:.1f}% | Hum={h_v:.0f}% | Comp={c_v:.1f}MPa | Idoneidad={s_v:.2f}"

        # --- FILA 1: Métricas de la simulación ---
        info_str = f"Paso: {step_count}  |  Micelio: {mycelium_count}  |  Puntas: {active_tips}  |  FPS: {target_fps}"
        text_info = font_main.render(info_str, True, COLOR_TEXT)
        text_status = font_main.render(f"[{status_text}]", True, status_color)
        
        screen.blit(text_info, (15, panel_top + 8))
        screen.blit(text_status, (SCREEN_WIDTH - text_status.get_width() - 15, panel_top + 8))

        # --- FILA 2: Lectura en tiempo real del sensor bajo el cursor ---
        if hover_info:
            text_sensor = font_sub.render(hover_info, True, (130, 210, 255))
            screen.blit(text_sensor, (15, panel_top + 31))
        else:
            text_sensor = font_sub.render("Pasa el mouse sobre el terreno para inspeccionar los sensores en cualquier coordenada", True, COLOR_TEXT_DIM)
            screen.blit(text_sensor, (15, panel_top + 31))

        # --- FILA 3: Control Interactivo de Concentración UFC/g (Slider + Input) ---
        # Etiqueta
        lbl_cfu = font_main.render("Inóculo UFC/g:", True, (52, 211, 153))
        screen.blit(lbl_cfu, (15, panel_top + 57))

        # Pista y relleno del Slider
        pygame.draw.rect(screen, (30, 41, 59), slider_rect, border_radius=5)
        pct = max(0.0, min(1.0, (current_cfu - MIN_CFU) / (MAX_CFU - MIN_CFU)))
        fill_w = int(pct * slider_rect.width)
        if fill_w > 0:
            fill_rect = pygame.Rect(slider_rect.x, slider_rect.y, fill_w, slider_rect.height)
            pygame.draw.rect(screen, (16, 185, 129), fill_rect, border_radius=5)
        pygame.draw.rect(screen, (71, 85, 105), slider_rect, width=1, border_radius=5)

        # Perilla del Slider
        thumb_x = slider_rect.x + fill_w
        thumb_y = slider_rect.y + slider_rect.height // 2
        thumb_color = (255, 255, 255) if slider_dragging else (52, 211, 153)
        pygame.draw.circle(screen, thumb_color, (thumb_x, thumb_y), 7)
        pygame.draw.circle(screen, (15, 23, 42), (thumb_x, thumb_y), 7, 1)

        # Campo de Texto
        box_bg = (15, 23, 42) if not input_active else (23, 37, 65)
        box_border = (56, 189, 248) if input_active else (71, 85, 105)
        pygame.draw.rect(screen, box_bg, input_box_rect, border_radius=4)
        pygame.draw.rect(screen, box_border, input_box_rect, width=2 if input_active else 1, border_radius=4)

        # Render de texto dentro del campo
        display_text = input_text
        txt_surface = font_code.render(display_text, True, (241, 245, 249))
        ty = input_box_rect.y + (input_box_rect.height - txt_surface.get_height()) // 2
        screen.blit(txt_surface, (input_box_rect.x + 6, ty))

        # Cursor parpadeante si el campo está enfocado
        if input_active and (pygame.time.get_ticks() // 500) % 2 == 0:
            cx = input_box_rect.x + 6 + txt_surface.get_width() + 1
            pygame.draw.line(screen, (56, 189, 248), (cx, ty + 2), (cx, ty + txt_surface.get_height() - 2), 2)

        # Unidades
        txt_unit = font_sub.render("UFC/g", True, COLOR_TEXT_DIM)
        screen.blit(txt_unit, (input_box_rect.right + 6, panel_top + 58))

        # Indicador de Vigor e Inóculo
        initial_cells_count = 1 if initial_rad == 0 else (5 if initial_rad == 1 else 13)
        vigor_str = f"Vigor: {int(cfu_vigor * 100)}% | Inóculo: ~{initial_cells_count} celdas (R={initial_rad})"
        badge_color = (251, 191, 36) if cfu_vigor >= 0.7 else ((52, 211, 153) if cfu_vigor >= 0.4 else (148, 163, 184))
        txt_badge = font_sub.render(vigor_str, True, badge_color)
        screen.blit(txt_badge, (input_box_rect.right + 54, panel_top + 58))

        # --- FILA 4: Controles y Modo Heatmap activo ---
        mode_labels = {
            "OFF": "Desactivado",
            "COMPOSITE": "Índice Compuesto (Inferno)",
            "ORGANIC": "Materia Orgánica / Nutrientes",
            "MOISTURE": "Humedad del Suelo",
            "COMPACTION": "Compactación (MPa)"
        }
        heatmap_text = f"Capa [C]: {mode_labels[current_mode]}"
        text_hm = font_sub.render(heatmap_text, True, (255, 215, 0) if current_mode != "OFF" else COLOR_TEXT_DIM)
        controls_str = "[Espacio] Pausa  |  [R] Reset  |  [C] Capas  |  [Clic] Inocular"
        text_ctrl = font_sub.render(controls_str, True, COLOR_TEXT_DIM)
        
        screen.blit(text_hm, (15, panel_top + 88))
        screen.blit(text_ctrl, (SCREEN_WIDTH - text_ctrl.get_width() - 15, panel_top + 88))

        pygame.display.flip()
        clock.tick(target_fps)

    pygame.quit()
    sys.exit()

if __name__ == "__main__":
    main()

