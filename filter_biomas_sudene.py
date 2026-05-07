import json
from shapely.geometry import shape, Polygon, MultiPolygon
from shapely.ops import unary_union

# Carregar os arquivos
with open('api/qg_2025_240_bioma.json', 'r') as f:
    biomas_data = json.load(f)

with open('api/SUDENE_2021.json', 'r') as f:
    sudene_data = json.load(f)

# Converter geometrias SUDENE para Shapely e fazer união
sudene_geometries = []
for feature in sudene_data['features']:
    try:
        geom = shape(feature['geometry'])
        sudene_geometries.append(geom)
    except Exception as e:
        print(f"Erro ao processar geometria SUDENE: {e}")

# União de todas as geometrias SUDENE
sudene_union = unary_union(sudene_geometries)

# Filtrar biomas que intersectam com a área SUDENE
filtered_features = []
for feature in biomas_data['features']:
    try:
        bioma_geom = shape(feature['geometry'])
        
        # Verificar interseção
        if bioma_geom.intersects(sudene_union):
            # Opcionalmente, fazer o recorte da geometria
            intersection = bioma_geom.intersection(sudene_union)
            
            if not intersection.is_empty:
                # Atualizar a geometria com a interseção
                feature['geometry'] = json.loads(json.dumps({
                    'type': intersection.geom_type,
                    'coordinates': list(intersection.coords) if hasattr(intersection, 'coords') else 
                                   [list(geom.exterior.coords) for geom in 
                                    ([intersection] if intersection.geom_type == 'Polygon' else intersection.geoms)]
                }))
                filtered_features.append(feature)
    except Exception as e:
        print(f"Erro ao processar bioma: {e}")

# Criar novo GeoJSON
output_data = {
    'type': 'FeatureCollection',
    'features': filtered_features
}

# Salvar arquivo filtrado
with open('api/qg_2025_240_bioma_sudene.json', 'w') as f:
    json.dump(output_data, f, indent=2)

print(f"Processo concluído!")
print(f"Biomas originais: {len(biomas_data['features'])}")
print(f"Biomas filtrados (dentro de SUDENE): {len(filtered_features)}")