<?php

namespace Tests\Feature;

use App\Models\Robot;
use App\Models\Terreno;
use App\Models\Capsula;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MycoApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }
    public function test_health_check(): void
    {
        $response = $this->getJson('/api/health');
        $response->assertStatus(200)
            ->assertJsonPath('status', 'ok')
            ->assertJsonPath('sistema', 'M.Y.C.O Backend API');
    }

    public function test_robots_listing_and_telemetry(): void
    {
        $response = $this->getJson('/api/robots');
        $response->assertStatus(200);

        $robot = Robot::first();
        $this->assertNotNull($robot);

        $ubicacionResponse = $this->getJson("/api/robots/{$robot->id}/ubicacion");
        $ubicacionResponse->assertStatus(200)
            ->assertJsonStructure([
                'robot_id',
                'nombre',
                'modo',
                'estado',
                'bateria',
                'capsulas_restantes' => ['minimo', 'medio', 'alto', 'total'],
            ]);
    }

    public function test_robot_cambiar_modo(): void
    {
        $robot = Robot::first();
        $response = $this->postJson("/api/robots/{$robot->id}/cambiar-modo", [
            'modo' => 'inyeccion',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('robot.modo', 'inyeccion');

        $this->assertEquals('inyeccion', $robot->fresh()->modo);
    }

    public function test_medicion_suelo_en_modo_lectura(): void
    {
        $robot = Robot::first();
        $terreno = Terreno::first();

        $response = $this->postJson('/api/mediciones', [
            'robot_id' => $robot->id,
            'terreno_id' => $terreno->id,
            'latitud' => 29.073500,
            'longitud' => -110.955100,
            'ph' => 6.85,
            'temperatura' => 22.3,
            'humedad' => 78.0, // Alta humedad -> debe sugerir cápsula de Grado Alto
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('medicion.es_optimo_inyeccion', true)
            ->assertJsonPath('medicion.grado_sugerido', 'alto');
    }

    public function test_capsulas_catalog(): void
    {
        $response = $this->getJson('/api/capsulas');
        $response->assertStatus(200);

        $response->assertJsonFragment(['grado' => 'minimo']);
        $response->assertJsonFragment(['grado' => 'medio']);
        $response->assertJsonFragment(['grado' => 'alto']);
    }

    public function test_optimizacion_recomendar_punto_entre_coordenadas(): void
    {
        $response = $this->postJson('/api/inyecciones/recomendar-punto', [
            'start' => ['lat' => 29.073100, 'lon' => -110.955400],
            'end' => ['lat' => 29.074500, 'lon' => -110.954000],
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'punto_optimo' => ['lat', 'lon', 'humedad', 'ph', 'temperatura'],
                'grado_capsula',
                'expansion_estimada_cm',
                'ahorro_recursos_pct',
                'justificacion',
            ]);
    }

    public function test_ejecutar_inyeccion_optimizada(): void
    {
        $robot = Robot::where('modo', 'inyeccion')->first() ?? Robot::first();
        $robot->update(['capsulas_alto' => 5, 'modo' => 'inyeccion']);

        $stockInicial = $robot->capsulas_alto;

        $response = $this->postJson('/api/inyecciones/ejecutar-optimizada', [
            'robot_id' => $robot->id,
            'latitud' => 29.073200,
            'longitud' => -110.955200,
            'humedad' => 80.0,
            'ph' => 6.9,
            'temperatura' => 21.0,
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('inyeccion.grado_capsula', 'alto');

        $this->assertEquals($stockInicial - 1, $robot->fresh()->capsulas_alto);
    }

    public function test_gemelo_digital_estado(): void
    {
        $response = $this->getJson('/api/gemelo-digital/estado');
        $response->assertStatus(200)
            ->assertJsonStructure([
                'timestamp',
                'estado_terreno' => [
                    'humedad_promedio_pct',
                    'ph_promedio',
                    'temperatura_promedio_c',
                    'expansion_micelial_m2',
                ],
                'flota_robots',
                'terrenos',
                'estaciones_base',
                'capsulas_catalogo',
            ]);
    }

    public function test_simulacion_temporal_marte(): void
    {
        $response = $this->postJson('/api/simulaciones/ejecutar', [
            'nombre' => 'Test Simulación Marte',
            'entorno' => 'marte',
            'tipo_condicion' => 'marte',
            'duracion_dias' => 15,
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('simulacion.entorno', 'marte')
            ->assertJsonPath('simulacion.tipo_condicion', 'marte')
            ->assertJsonStructure([
                'simulacion',
                'resumen' => [
                    'condiciones_ambientales',
                    'resultados' => ['cobertura_final_m2', 'tasa_supervivencia_final_pct', 'timeline'],
                ],
            ]);
    }

    public function test_compatibilidad_frontend_rutas_y_biopolimeros(): void
    {
        $this->getJson('/api/rutas')->assertStatus(200);
        $this->getJson('/api/biopolimeros')->assertStatus(200);
        $this->getJson('/api/zonas-toxicas')->assertStatus(200);
    }
}
