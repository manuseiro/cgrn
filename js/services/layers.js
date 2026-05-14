/**
 * @file layers.js
 * @description Carrega camadas personalizadas definidas no Admin.
 */
import { log, warn } from '../components/ui.js';

export async function loadCustomLayers(map) {
    try {
        const response = await fetch('api/get_layers.php');
        const res = await response.json();
        
        if (res.status !== 'success') return;

        res.data.forEach(l => {
            log(`[layers] Carregando camada: ${l.layer_name}`);
            
            let layer;
            const params = l.layer_params ? JSON.parse(l.layer_params) : {};

            if (l.layer_type === 'WMS') {
                layer = L.tileLayer.wms(l.layer_url, {
                    transparent: true,
                    format: 'image/png',
                    ...params
                });
            } else if (l.layer_type === 'GeoJSON') {
                fetch(l.layer_url)
                    .then(r => r.json())
                    .then(data => {
                        L.geoJSON(data, params).addTo(map);
                    })
                    .catch(e => warn(`Erro ao carregar GeoJSON: ${l.layer_name}`, e));
            }

            if (layer) layer.addTo(map);
        });
    } catch (e) {
        warn('Erro ao carregar camadas personalizadas do Admin', e);
    }
}
