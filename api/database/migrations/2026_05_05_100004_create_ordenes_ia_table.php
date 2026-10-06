<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ordenes_ia', function (Blueprint $table) {
            $table->id();
            $table->integer('prioridad')->default(5); // 1-10
            $table->enum('tipo_accion', ['inyectar', 'sembrar', 'escanear']);
            $table->decimal('punto_lat', 10, 6);
            $table->decimal('punto_lon', 10, 6);
            $table->text('razon')->nullable(); // por qué la IA generó esta orden
            $table->enum('estado', ['pendiente', 'en-progreso', 'completada', 'cancelada'])->default('pendiente');
            $table->timestamp('fecha_creacion');
            $table->timestamp('fecha_ejecucion')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ordenes_ia');
    }
};
