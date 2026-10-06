<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('zona_toxicas', function (Blueprint $table) {
            $table->id();
            $table->decimal('latitud', 10, 6);
            $table->decimal('longitud', 10, 6);
            $table->float('radio')->default(5.0); // Radio visual o en kilómetros
            $table->integer('nivel_toxicidad')->default(50); // 0 a 100
            $table->boolean('activa')->default(true);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('zona_toxicas');
    }
};
