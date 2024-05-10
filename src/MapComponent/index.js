import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl"; // Importing maplibre-gl library
import { Threebox } from 'threebox-plugin'; // Importing Threebox library
import './index.css';
import { addHDRIToThreebox, getDirections, hdrTexture } from "../Animation/utils"; // Importing utility functions
import { Loader } from "@googlemaps/js-api-loader"; // Importing Loader from Google Maps JavaScript API
import { AnimationController } from "../Animation/Animation"; // Importing AnimationController component

const MapComponent = () => {
  // Initializing refs and state variables
  const mapContainer = useRef();
  const map = useRef();
  const [zoom] = useState(6.5);
  const lng = -76.06066408420659;
  const lat = 44.36919079826513;
  const tb = useRef();
  const carModelRef = useRef();
  const animationControllers = useRef();

  // Style data for the map
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
  };

  // Google Maps API Loader configuration
  const loader = new Loader({
    apiKey: process.env.REACT_APP_GOOGLE_API_KEY,
    version: 'weekly',
    authReferrerPolicy: 'origin',
  });

  const scale = 1300;
  const carOpt = {
    obj: './car.glb',
    scale: { x: scale, y: scale, z: scale },
    type: 'gltf',
    anchor: 'auto',
  };

  // State variable for storing the route
  const [route, setRoute] = useState();

  // Custom layer for 3D rendering
  const content3DLayer = {
    id: 'custom-threebox-model',
    type: 'custom',
    renderingMode: '3d',
    render: () => {
      if (tb.current) tb.current.update(); // Update Threebox
      if (animationControllers.current) animationControllers.current.animate(); // Animate if AnimationController exists
      map.current.repaint = true; // Repaint the map
    },
  };

  // Function to add travel layer (line representing travel path)
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

  // useEffect to initialize the map and Threebox
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
      .then((path) => {
        setRoute(path); // Set the route received from directions API
      });

    return () => {
      map.current.remove(); // Cleanup function to remove the map
    };
  }, [lng, lat, zoom]);

  // Function to load 3D model resources
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

  // Function to add animation line layers
  function addAnimationLineLayers() {
    if (map.current) {
      let id = 'route';
      const source = map.current.getSource(id);

      if (!source)
        addTravelLayer(id);
    }
  }

  // Function to load custom layers
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

  // useEffect to load layers once style data is loaded
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

  // useEffect to setup model resources and start animation
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
        animationControllers.current.startAnimation(); // Start the animation
      }
    });
  }, [route]);

  return <div ref={mapContainer} className="map-container" />;
};

export default MapComponent;
