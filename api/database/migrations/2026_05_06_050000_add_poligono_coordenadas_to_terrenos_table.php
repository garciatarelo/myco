<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('terrenos', function (Blueprint $table) {
            $table->json('poligono_coordenadas')->nullable()->after('longitud_central');
        });
    }

    public function down(): void
    {
        Schema::table('terrenos', function (Blueprint $table) {
            $table->dropColumn('poligono_coordenadas');
        });
    }
};
