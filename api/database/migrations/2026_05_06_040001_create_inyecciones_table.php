<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inyecciones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('robot_id')->constrained('robots')->cascadeOnDelete();
            $table->foreignId('capsula_id')->nullable()->constrained('capsulas')->nullOnDelete();
            $table->foreignId('terreno_id')->nullable()->constrained('terrenos')->nullOnDelete();
            $table->foreignId('ruta_id')->nullable()->constrained('rutas')->nullOnDelete();
            $table->decimal('latitud', 10, 6);
            $table->decimal('longitud', 10, 6);
            $table->enum('grado_capsula', ['minimo', 'medio', 'alto']);
            $table->decimal('humedad_suelo_detectada', 5, 2)->nullable();
            $table->decimal('ph_detectado', 4, 2)->nullable();
            $table->decimal('temperatura_detectada', 5, 2)->nullable();
            $table->float('expansion_micelio_estimada_cm')->default(25.0);
            $table->float('ahorro_recurso_porcentaje')->default(0.0);
            $table->text('justificacion_algoritmo')->nullable();
            $table->timestamp('fecha_inyeccion')->useCurrent();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inyecciones');
    }
};
