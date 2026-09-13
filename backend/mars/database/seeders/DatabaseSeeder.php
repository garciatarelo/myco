<?php

namespace Database\Seeders;

use App\Models\Capsula;
use App\Models\EstacionBase;
use App\Models\Inyeccion;
use App\Models\MedicionSuelo;
use App\Models\Robot;
use App\Models\Ruta;
use App\Models\Simulacion;
use App\Models\Terreno;
use App\Models\User;
use App\Models\ZonaToxica;
use App\Models\Biopolimero;
use App\Services\OptimizacionMycoService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $optService = new OptimizacionMycoService();

        // 1. Usuarios: Administradores y Clientes
        $admin = User::firstOrCreate(
            ['email' => 'admin@myco.tech'],
            [
                'name' => 'Administrador Myco Tech',
                'password' => Hash::make('admin123'),
                'rol' => 'admin',
                'telefono' => '+52 662 100 2030',
                'organizacion' => 'M.Y.C.O Robotics & Bioremediation Labs',
            ]
        );

        $cliente1 = User::firstOrCreate(
            ['email' => 'cliente@agromar.com'],
            [
                'name' => 'Ing. Sofía Valenzuela (AgroMar)',
                'password' => Hash::make('cliente123'),
                'rol' => 'cliente',
                'telefono' => '+52 662 450 8999',
                'organizacion' => 'AgroMar Biotecnología Agrícola',
            ]
        );

        $cliente2 = User::firstOrCreate(
            ['email' => 'ares@marsmatrix.space'],
            [
                'name' => 'Dr. Carlos Mendoza (Mars Bio-Pioneers)',
                'password' => Hash::make('marte123'),
                'rol' => 'cliente',
                'telefono' => '+1 415 555 0192',
                'organizacion' => 'Mars Matrix Planetary Remediations',
            ]
        );

        // 2. Terrenos (Tierra y Marte)
        $terrenoTierra = Terreno::create([
            'nombre' => 'Valle de Inoculación Alpha (Tierra)',
            'descripcion' => 'Campo de remediación agrícola y expansión de red micelial con suelo fértil.',
            'cliente_id' => $cliente1->id,
            'entorno' => 'tierra',
            'latitud_central' => 29.072967,
            'longitud_central' => -110.955919,
            'dimensiones_m2' => 25000,
            'red_wifi_ssid' => 'Myco-Field-WiFi-5G',
            'red_wifi_pass' => 'myco2026wifi',
            'red_wifi_status' => 'activa',
        ]);

        $terrenoMarte = Terreno::create([
            'nombre' => 'Cráter Jezero - Cuadrante Ares (Marte)',
            'descripcion' => 'Zona marciana experimental de remediación de regolito con micorrizas xerotolerantes.',
            'cliente_id' => $cliente2->id,
            'entorno' => 'marte',
            'latitud_central' => 18.380000,
            'longitud_central' => 77.580000,
            'dimensiones_m2' => 50000,
            'red_wifi_ssid' => 'Starlink-Mars-Mesh-Net',
            'red_wifi_pass' => 'jezeroAres2026',
            'red_wifi_status' => 'activa',
        ]);

        // 3. Estaciones Base (Recarga de batería y cápsulas)
        $baseAlpha = EstacionBase::create([
            'nombre' => 'Estación Base Alpha-Dock 1',
            'terreno_id' => $terrenoTierra->id,
            'latitud' => 29.072900,
            'longitud' => -110.955900,
            'estado' => 'operativa',
            'stock_capsulas_minimo' => 150,
            'stock_capsulas_medio' => 200,
            'stock_capsulas_alto' => 120,
        ]);

        $baseMarte = EstacionBase::create([
            'nombre' => 'Módulo Base Jezero Dock-01',
            'terreno_id' => $terrenoMarte->id,
            'latitud' => 18.380100,
            'longitud' => 77.580100,
            'estado' => 'operativa',
            'stock_capsulas_minimo' => 300,
            'stock_capsulas_medio' => 250,
            'stock_capsulas_alto' => 180,
        ]);

        // 4. Catálogo de Cápsulas (Grados Mínimo, Medio y Alto determinados por cantidad de micorrizas)
        $capsulaMin = Capsula::create([
            'nombre' => 'BioCapsule Xero-Min (Grado Mínimo)',
            'grado' => 'minimo',
            'cantidad_micorrizas' => 1500, // 1,500 UFC/g
            'unidad_medida' => 'UFC/g',
            'tipo_hongo' => 'Rhizophagus irregularis (cepa resistente)',
            'humedad_suelo_optima_min' => 20.0,
            'humedad_suelo_optima_max' => 40.0,
            'radio_expansion_estimado_m' => 0.8,
            'costo_recurso' => 1.0,
            'descripcion' => 'Cápsula de formulación base para terrenos áridos o baja humedad, protegiendo los recursos de inoculación.',
            'activa' => true,
        ]);

        $capsulaMed = Capsula::create([
            'nombre' => 'BioCapsule Eco-Med (Grado Medio)',
            'grado' => 'medio',
            'cantidad_micorrizas' => 7500, // 7,500 UFC/g
            'unidad_medida' => 'UFC/g',
            'tipo_hongo' => 'Glomus intraradices + Funneliformis mosseae',
            'humedad_suelo_optima_min' => 40.0,
            'humedad_suelo_optima_max' => 65.0,
            'radio_expansion_estimado_m' => 2.0,
            'costo_recurso' => 2.2,
            'descripcion' => 'Cápsula de concentración media para suelos con humedad balanceada y crecimiento sostenido del micelio.',
            'activa' => true,
        ]);

        $capsulaHigh = Capsula::create([
            'nombre' => 'HyperSpore Dense-High (Grado Alto)',
            'grado' => 'alto',
            'cantidad_micorrizas' => 25000, // 25,000 UFC/g
            'unidad_medida' => 'UFC/g',
            'tipo_hongo' => 'Consorcio Glomus + Trichoderma + Pleurotus',
            'humedad_suelo_optima_min' => 65.0,
            'humedad_suelo_optima_max' => 95.0,
            'radio_expansion_estimado_m' => 3.8,
            'costo_recurso' => 4.0,
            'descripcion' => 'Cápsula de alto rendimiento micelar para inyectar en coordenadas con alta humedad y multiplicar exponencialmente la red.',
            'activa' => true,
        ]);

        // 5. Robots Myco
        // Robot 1: En modo lectura
        $robot1 = Robot::create([
            'nombre' => 'Myco-01 (Lectura)',
            'modelo' => 'Myco-Explorer-v1',
            'numero_serie' => 'MYCO-SN-1001',
            'terreno_id' => $terrenoTierra->id,
            'estacion_base_id' => $baseAlpha->id,
            'estado' => 'activo',
            'modo' => 'lectura', // "Un robot puede estar en dos estados, ya sea en modo lectura o inyeccion"
            'latitud' => 29.073200,
            'longitud' => -110.955500,
            'latitud_marte' => 29.073200,
            'longitud_marte' => -110.955500,
            'bateria' => 88,
            'en_estacion_base' => false,
            'wifi_ssid' => 'Myco-Field-WiFi-5G',
            'wifi_conectado' => true,
            'wifi_ip' => '192.168.1.101',
            'wifi_rssi' => -54,
            'capacidad_capsulas' => 30,
            'capsulas_minimo' => 10,
            'capsulas_medio' => 10,
            'capsulas_alto' => 10,
            'configuracion' => [
                'velocidad_m_s' => 0.6,
                'intervalo_lectura_seg' => 15,
                'umbral_humedad_alerta' => 18.0,
            ],
            'sensores_ir' => ['humedad' => 74, 'toxicidad' => 5],
        ]);

        // Robot 2: En modo inyección
        $robot2 = Robot::create([
            'nombre' => 'Myco-02 (Inyección)',
            'modelo' => 'Myco-Injector-v1',
            'numero_serie' => 'MYCO-SN-1002',
            'terreno_id' => $terrenoTierra->id,
            'estacion_base_id' => $baseAlpha->id,
            'estado' => 'activo',
            'modo' => 'inyeccion', // Modo inyección
            'latitud' => 29.074100,
            'longitud' => -110.954700,
            'latitud_marte' => 29.074100,
            'longitud_marte' => -110.954700,
            'bateria' => 78,
            'en_estacion_base' => false,
            'wifi_ssid' => 'Myco-Field-WiFi-5G',
            'wifi_conectado' => true,
            'wifi_ip' => '192.168.1.102',
            'wifi_rssi' => -60,
            'capacidad_capsulas' => 35,
            'capsulas_minimo' => 6,
            'capsulas_medio' => 11,
            'capsulas_alto' => 14,
            'configuracion' => [
                'velocidad_m_s' => 0.4,
                'profundidad_inyeccion_cm' => 12,
                'ahorro_recursos_activo' => true,
            ],
            'sensores_ir' => ['humedad' => 81, 'toxicidad' => 2],
        ]);

        // Robot 3: Simulación en Marte
        $robotMarte = Robot::create([
            'nombre' => 'Myco-Mars-Ares',
            'modelo' => 'Myco-Rover-Extreme',
            'numero_serie' => 'MYCO-MARS-001',
            'terreno_id' => $terrenoMarte->id,
            'estacion_base_id' => $baseMarte->id,
            'estado' => 'activo',
            'modo' => 'inyeccion',
            'latitud' => 18.381200,
            'longitud' => 77.581500,
            'latitud_marte' => 18.381200,
            'longitud_marte' => 77.581500,
            'bateria' => 92,
            'en_estacion_base' => false,
            'wifi_ssid' => 'Starlink-Mars-Mesh-Net',
            'wifi_conectado' => true,
            'wifi_ip' => '10.42.0.10',
            'wifi_rssi' => -48,
            'capacidad_capsulas' => 45,
            'capsulas_minimo' => 15,
            'capsulas_medio' => 15,
            'capsulas_alto' => 15,
            'configuracion' => [
                'blindaje_termico' => 'activo',
                'calefaccion_capsulas' => true,
                'optimizacion_regolito' => true,
            ],
            'sensores_ir' => ['humedad' => 22, 'toxicidad' => 15],
        ]);

        // 6. Mediciones de Suelo tomadas por Myco-01 en modo lectura
        // Demostrando variación de humedad para el algoritmo de optimización
        $medicionesMuestra = [
            ['lat' => 29.073100, 'lon' => -110.955400, 'ph' => 6.8, 'temp' => 21.5, 'hum' => 78.5], // Óptimo para Grado Alto
            ['lat' => 29.073300, 'lon' => -110.955200, 'ph' => 6.9, 'temp' => 22.0, 'hum' => 75.0], // Óptimo para Grado Alto
            ['lat' => 29.073500, 'lon' => -110.955000, 'ph' => 6.7, 'temp' => 21.8, 'hum' => 52.0], // Grado Medio
            ['lat' => 29.073700, 'lon' => -110.954800, 'ph' => 6.5, 'temp' => 23.1, 'hum' => 48.0], // Grado Medio
            ['lat' => 29.073900, 'lon' => -110.954600, 'ph' => 7.2, 'temp' => 24.0, 'hum' => 26.5], // Grado Mínimo
            ['lat' => 29.074100, 'lon' => -110.954400, 'ph' => 7.5, 'temp' => 26.2, 'hum' => 14.0], // Demasiado seco (<20%) -> Ahorro
            ['lat' => 29.074300, 'lon' => -110.954200, 'ph' => 6.8, 'temp' => 22.4, 'hum' => 82.0], // Óptimo para Grado Alto
            ['lat' => 29.074500, 'lon' => -110.954000, 'ph' => 6.6, 'temp' => 21.9, 'hum' => 69.5], // Óptimo para Grado Alto
        ];

        foreach ($medicionesMuestra as $m) {
            $eval = $optService->evaluarCondicionesSuelo($m['hum'], $m['ph'], $m['temp']);

            MedicionSuelo::create([
                'robot_id' => $robot1->id,
                'terreno_id' => $terrenoTierra->id,
                'latitud' => $m['lat'],
                'longitud' => $m['lon'],
                'ph' => $m['ph'],
                'temperatura' => $m['temp'],
                'humedad' => $m['hum'],
                'conductividad' => 1.45,
                'es_optimo_inyeccion' => $eval['es_optimo'],
                'grado_sugerido' => $eval['grado_recomendado'],
                'fecha_medicion' => now()->subMinutes(rand(5, 120)),
            ]);
        }

        // 7. Inyecciones de prueba realizadas por Myco-02 en modo inyección
        Inyeccion::create([
            'robot_id' => $robot2->id,
            'capsula_id' => $capsulaHigh->id,
            'terreno_id' => $terrenoTierra->id,
            'latitud' => 29.073150,
            'longitud' => -110.955350,
            'grado_capsula' => 'alto',
            'humedad_suelo_detectada' => 78.5,
            'ph_detectado' => 6.8,
            'temperatura_detectada' => 21.5,
            'expansion_micelio_estimada_cm' => 40.5,
            'ahorro_recurso_porcentaje' => 35.0,
            'justificacion_algoritmo' => 'Punto de alta humedad (78.5%) detectado entre coordenadas. Inyección de Grado Alto (25,000 UFC/g) ejecutada para máxima colonización.',
            'fecha_inyeccion' => now()->subMinutes(45),
        ]);

        Inyeccion::create([
            'robot_id' => $robot2->id,
            'capsula_id' => $capsulaMed->id,
            'terreno_id' => $terrenoTierra->id,
            'latitud' => 29.073600,
            'longitud' => -110.954900,
            'grado_capsula' => 'medio',
            'humedad_suelo_detectada' => 50.0,
            'ph_detectado' => 6.7,
            'temperatura_detectada' => 22.0,
            'expansion_micelio_estimada_cm' => 25.0,
            'ahorro_recurso_porcentaje' => 50.0,
            'justificacion_algoritmo' => 'Humedad moderada (50.0%). Cápsula Grado Medio inyectada para crecimiento sostenido y ahorro de cápsulas de alta concentración.',
            'fecha_inyeccion' => now()->subMinutes(25),
        ]);

        Inyeccion::create([
            'robot_id' => $robot2->id,
            'capsula_id' => $capsulaHigh->id,
            'terreno_id' => $terrenoTierra->id,
            'latitud' => 29.074350,
            'longitud' => -110.954150,
            'grado_capsula' => 'alto',
            'humedad_suelo_detectada' => 82.0,
            'ph_detectado' => 6.8,
            'temperatura_detectada' => 22.4,
            'expansion_micelio_estimada_cm' => 42.0,
            'ahorro_recurso_porcentaje' => 35.0,
            'justificacion_algoritmo' => 'Excelente retención de humedad (82.0%). Inoculación prioritaria de Grado Alto logrando expansión micelar rápida.',
            'fecha_inyeccion' => now()->subMinutes(10),
        ]);

        // 8. Simulaciones Temporales (Ideal, Extrema y Planeta Marte)
        $simIdeal = $optService->ejecutarSimulacionTemporal(
            'Simulación Tierra - Condiciones Ideales de Inoculación',
            'tierra',
            'ideal',
            30
        );
        Simulacion::create([
            'nombre' => $simIdeal['nombre'],
            'entorno' => $simIdeal['entorno'],
            'tipo_condicion' => $simIdeal['tipo_condicion'],
            'parametros' => $simIdeal['condiciones_ambientales'],
            'resultados' => $simIdeal['resultados'],
            'terreno_id' => $terrenoTierra->id,
            'robot_id' => $robot2->id,
            'duracion_dias' => 30,
            'cobertura_micelio_porcentaje' => 96.5,
            'estado' => 'completada',
        ]);

        $simExtrema = $optService->ejecutarSimulacionTemporal(
            'Simulación Tierra - Estrés Hídrico y Sequía Extrema',
            'tierra',
            'extrema',
            30
        );
        Simulacion::create([
            'nombre' => $simExtrema['nombre'],
            'entorno' => $simExtrema['entorno'],
            'tipo_condicion' => $simExtrema['tipo_condicion'],
            'parametros' => $simExtrema['condiciones_ambientales'],
            'resultados' => $simExtrema['resultados'],
            'terreno_id' => $terrenoTierra->id,
            'duracion_dias' => 30,
            'cobertura_micelio_porcentaje' => 38.2,
            'estado' => 'completada',
        ]);

        $simMarte = $optService->ejecutarSimulacionTemporal(
            'Simulación Planeta Marte - Remediación Regolito Cráter Jezero',
            'marte',
            'marte',
            60,
            ['temperatura' => -55.0, 'humedad' => 8.0]
        );
        Simulacion::create([
            'nombre' => $simMarte['nombre'],
            'entorno' => $simMarte['entorno'],
            'tipo_condicion' => $simMarte['tipo_condicion'],
            'parametros' => $simMarte['condiciones_ambientales'],
            'resultados' => $simMarte['resultados'],
            'terreno_id' => $terrenoMarte->id,
            'robot_id' => $robotMarte->id,
            'duracion_dias' => 60,
            'cobertura_micelio_porcentaje' => 68.4,
            'estado' => 'completada',
        ]);

        // 9. Datos para compatibilidad con rutas existentes (Frontend)
        $ruta1 = Ruta::create([
            'robot_id' => $robot2->id,
            'puntos_json' => [
                ['lat' => 29.073100, 'lon' => -110.955400],
                ['lat' => 29.073500, 'lon' => -110.955000],
                ['lat' => 29.074000, 'lon' => -110.954500],
            ],
            'distancia_total' => 0.15,
            'tiempo_estimado' => 900,
            'estado' => 'en-progreso',
        ]);

        Biopolimero::create([
            'ruta_id' => $ruta1->id,
            'latitud_marte' => 29.073150,
            'longitud_marte' => -110.955350,
            'tipo_micelio' => 'HyperSpore High-25000',
            'nivel_crecimiento' => 45,
            'humedad_detectada' => 78,
            'toxicidad' => 3,
            'fecha_siembra' => now()->subDays(2),
        ]);

        ZonaToxica::create([
            'latitud' => 29.075000,
            'longitud' => -110.953000,
            'radio' => 15.0,
            'nivel_toxicidad' => 65,
            'activa' => true,
        ]);
    }
}
