<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('simulaciones', function (Blueprint $table) {
            $table->id();
            $table->string('nombre');
            $table->enum('entorno', ['tierra', 'marte'])->default('tierra');
            $table->enum('tipo_condicion', ['ideal', 'extrema', 'marte', 'personalizada'])->default('ideal');
            $table->json('parametros')->nullable();
            $table->json('resultados')->nullable();
            $table->foreignId('terreno_id')->nullable()->constrained('terrenos')->nullOnDelete();
            $table->foreignId('robot_id')->nullable()->constrained('robots')->nullOnDelete();
            $table->integer('duracion_dias')->default(30);
            $table->float('cobertura_micelio_porcentaje')->default(0.0);
            $table->enum('estado', ['completada', 'en_progreso', 'fallida'])->default('completada');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('simulaciones');
    }
};
