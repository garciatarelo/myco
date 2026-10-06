<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('terrenos', function (Blueprint $table) {
            $table->json('condiciones_terreno')->nullable()->after('poligono_coordenadas');
            $table->json('elevacion_data')->nullable()->after('condiciones_terreno');
            $table->json('rutas_rovers')->nullable()->after('elevacion_data');
            $table->json('clusters_muestreo')->nullable()->after('rutas_rovers');
            $table->json('puntos_inicio_escaneo')->nullable()->after('clusters_muestreo');
        });
    }

    public function down(): void
    {
        Schema::table('terrenos', function (Blueprint $table) {
            $table->dropColumn([
                'condiciones_terreno',
                'elevacion_data',
                'rutas_rovers',
                'clusters_muestreo',
                'puntos_inicio_escaneo',
            ]);
        });
    }
};
