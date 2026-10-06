<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rutas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('robot_id')->constrained('robots')->onDelete('cascade');
            $table->json('puntos_json'); // array de coordenadas [{lat, lon}, ...]
            $table->decimal('distancia_total', 10, 2)->default(0);
            $table->integer('tiempo_estimado')->default(0); // segundos
            $table->enum('estado', ['planificada', 'en-progreso', 'completada', 'cancelada'])->default('planificada');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rutas');
    }
};
