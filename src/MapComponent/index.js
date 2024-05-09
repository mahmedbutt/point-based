import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { Threebox } from 'threebox-plugin';
import './index.css';
import { addHDRIToThreebox, getDirections, hdrTexture } from "../utils";
import { Loader } from "@googlemaps/js-api-loader";
import { AnimationController } from "../Animation";

const MapComponent = () => {
  const mapContainer = useRef();
  const map = useRef();
  const [zoom] = useState(6.5);
  const lng = -76.06066408420659;
  const lat = 44.36919079826513;
  const tb = useRef();
  const carModelRef = useRef();
  const animationControllers = useRef();
  const styleData = {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        attribution: '&copy; OpenStreetMap Contributors',
        maxzoom: 19,
      },
    },
    layers: [
      {
        id: 'osm',
        type: 'raster',
        source: 'osm',
      },
    ],
  }
  const loader = new Loader({
    apiKey: process.env.REACT_APP_GOOGLE_API_KEY,
    version: 'weekly',
    authReferrerPolicy: 'origin',
  });
  const scale = 1300
  const carOpt = {
    obj: './car.glb',
    scale: { x: scale, y: scale, z: scale },
    type: 'gltf',
    anchor: 'auto',

  };

  const [route, setRoute] = useState()

  const content3DLayer = {
    id: 'custom-threebox-model',
    type: 'custom',
    renderingMode: '3d',
    render: () => {
      if (tb.current) tb.current.update();

      if (animationControllers.current) animationControllers.current.animate()

      map.current.repaint = true;

    },
  };

  function addTravelLayer(id, obj = []) {


    map.current?.addSource(id, {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: obj,
        },
      },
    });

    map.current?.addLayer({
      id: id,
      type: 'line',
      source: id,
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': '#FE7138',
        'line-width': 3,
      },
    });

    map.current.moveLayer('custom-threebox-model');

  }


  useEffect(() => {
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      attributionControl: false,
      style: styleData,
      center: [lng, lat],
      zoom: zoom,
      antialias: true,
      interactive: false,
    });

    tb.current = window.tb = new Threebox(
      map.current,
      map.current.getCanvas().getContext('webgl'),
      {
        defaultLights: false,
      },
    );

    addHDRIToThreebox(tb.current, hdrTexture);


    map.current.on('load', function () {
      map.current?.addLayer(content3DLayer);
    });

    getDirections(loader)
      .then(
        (path) => {
          setRoute(path)
        }
      );


    return () => {
      map.current.remove();
    };


  }, [lng, lat, zoom]);

  function loadModel(
    options,
    modelRef,
  ) {
    return new Promise((resolve) => {
      tb.current.loadObj(
        options,
        (model) => {
          modelRef.current = model;
          modelRef.current.visible = false;
          modelRef.current.up.set(0, 0, 1);
          modelRef.current.scale.set(0, 0, 0);

          tb.current.add(model);
          resolve(); // Resolve the promise when the model is loaded
        }
      );
    });
  }

  async function setupModelResources() {
    try {
      await Promise.all([
        loadModel(carOpt, carModelRef),
      ]);

    } catch (error) {
      console.error('Error loading models:', error);
    }
  }

  function addAnimationLineLayers() {
    if (map.current) {
      let id = 'route';
      const source = map.current.getSource(id)

      if (!source)
        addTravelLayer(id);
    }
  }

  function loadMyLayers() {
    if (map.current?.getLayer('custom-threebox-model')) {
      map.current.removeLayer('custom-threebox-model');
    }
    map.current?.addLayer(content3DLayer);

    addAnimationLineLayers();
  }

  useEffect(() => {
    map.current?.setStyle(styleData);
  }, []);

  useEffect(() => {
    map.current?.once('styledata', function () {
      const waiting = () => {
        if (!map.current?.isStyleLoaded()) {
          setTimeout(waiting, 200);
        } else {
          loadMyLayers();
        }
      };
      waiting();
    });
  });


  useEffect(() => {
    setupModelResources().then(() => {
      if (route) {
        animationControllers.current = new AnimationController(
          map.current,
          carModelRef.current,
          route
        );

        if (!map.current?.isStyleLoaded()) {
          map.current?.once('styledata', () => {
            addAnimationLineLayers();
          });
        }
        animationControllers.current.startAnimation();

      }
    })

  }, [route])

  return <div ref={mapContainer} className="map-container" />;
};

export default MapComponent;
