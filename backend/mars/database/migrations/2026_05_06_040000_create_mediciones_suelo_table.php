<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mediciones_suelo', function (Blueprint $table) {
            $table->id();
            $table->foreignId('robot_id')->constrained('robots')->cascadeOnDelete();
            $table->foreignId('terreno_id')->nullable()->constrained('terrenos')->nullOnDelete();
            $table->decimal('latitud', 10, 6);
            $table->decimal('longitud', 10, 6);
            $table->decimal('ph', 4, 2);
            $table->decimal('temperatura', 5, 2);
            $table->decimal('humedad', 5, 2);
            $table->decimal('conductividad', 6, 2)->nullable();
            $table->boolean('es_optimo_inyeccion')->default(false);
            $table->enum('grado_sugerido', ['minimo', 'medio', 'alto', 'ninguno'])->default('ninguno');
            $table->timestamp('fecha_medicion')->useCurrent();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mediciones_suelo');
    }
};
