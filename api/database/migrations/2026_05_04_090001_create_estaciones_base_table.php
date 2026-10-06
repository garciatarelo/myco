<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('estaciones_base', function (Blueprint $table) {
            $table->id();
            $table->string('nombre');
            $table->foreignId('terreno_id')->nullable()->constrained('terrenos')->nullOnDelete();
            $table->decimal('latitud', 10, 6)->default(0);
            $table->decimal('longitud', 10, 6)->default(0);
            $table->enum('estado', ['operativa', 'ocupada', 'mantenimiento'])->default('operativa');
            $table->integer('stock_capsulas_minimo')->default(100);
            $table->integer('stock_capsulas_medio')->default(100);
            $table->integer('stock_capsulas_alto')->default(100);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('estaciones_base');
    }
};
