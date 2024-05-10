/* eslint-disable no-undef */

import { AmbientLight, BoxGeometry, CatmullRomCurve3, Color, EquirectangularReflectionMapping, Mesh, MeshBasicMaterial, UnsignedByteType, Vector2, Vector3 } from "three";
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader';
import { CustomEase } from 'gsap/all';
import { LineBasicMaterial } from "three";
import { Line } from "three";


// This function retrieves directions between two locations using the Google Maps Directions API
export async function getDirections(loader, origin = { placeId: 'ChIJDbdkHFQayUwR7-8fITgxTmU' }, destination = { placeId: 'ChIJpTvG15DL1IkRd8S0KlBVNTI' }) {

  // Asynchronously import the required library (geometry) using the loader
  await loader.importLibrary("geometry");

  // Return a promise to handle asynchronous behavior
  return new Promise((resolve, reject) => {
    // Initialize the DirectionsService provided by Google Maps API
    const directionsService = new google.maps.DirectionsService();
    // Set up the request object containing origin, destination, and travel mode
    const request = {
      origin: { placeId: origin.placeId }, // Origin location
      destination: { placeId: destination.placeId }, // Destination location
      travelMode: google.maps.TravelMode.DRIVING, // Travel mode (driving)
    };

    // Call the DirectionsService's route method to calculate directions
    directionsService.route(request, (result, status) => {
      // Check if the request was successful
      if (status === "OK") {
        // Check if there are any routes returned
        if (result.routes && result.routes.length > 0) {
          // Extract all steps from the route
          let steps = result?.routes[0].legs[0].steps;
          let allPoints = [];

          // Concatenate all path points from each step into one array
          for (let step of steps) {
            let path = step.path;
            allPoints = allPoints.concat(path);
          }

          // Convert the concatenated points into a GeoJSON LineString format
          const lineString = {
            type: "LineString",
            coordinates: allPoints.map((point) => [point.lng(), point.lat()]), // Convert LatLng objects to [lng, lat] format
          };

          // Resolve the promise with the LineString
          resolve(lineString);
        } else {
          // If no routes are available, resolve with an empty array
          const res = []
          resolve(res);
        }
      } else {
        // If the request was not successful, resolve with an empty array
        const res = []
        resolve(res);
      }
    });
  });
}

const devmode = false;
const easingFunction = CustomEase.create(
  'custom',
  'M0,0 C0,0 0.07,0.607 0.089,0.659 0.102,0.695 0.12,0.786 0.129,0.82 0.141,0.871 0.175,0.884 0.2,0.9 0.22,0.950 0.275,0.955 0.334,0.977 0.349,0.988 0.419,0.995 0.498,0.997 0.499,0.999 0.622,0.9995 0.665,0.9995 0.668,0.9997 0.725,0.9997 0.755,0.9999 0.808,0.99992 0.858,0.99995 0.908,0.99998 0.9980,0.99999 1,0.999990 1,1 ',
);

function mapRange(
  input,
  inMin,
  inMax,
  outMin,
  outMax,
) {
  // Ensure input is within the specified range
  input = Math.min(Math.max(input, inMin), inMax);

  // Map the input range to the output range
  const inputRange = inMax - inMin;
  const outputRange = outMax - outMin;

  if (devmode) console.log('input: ', input);

  const inputScale = (input - inMin) / inputRange; // Input values are normalized to 0-1 range
  if (devmode) console.log('inputscale: ', inputScale);
  const easedInputScale = easingFunction(inputScale);
  if (devmode) console.log('custom:', easedInputScale);

  return outMax - easedInputScale * outputRange + outMin;
}

// This function is defined to load an HDR texture using RGBELoader from Three.js.
// It returns a Promise that resolves to the loaded HDR texture.

export function loadHDRITexture() {
  return new RGBELoader()                         // Create a new RGBELoader instance
    .setDataType(UnsignedByteType)                // Set the data type of the texture to UnsignedByteType
    .setPath('./')                                // Set the path to the directory where the HDR file is located
    .load('industrial_sunset_puresky_2k.hdr');   // Load the HDR texture named 'industrial_sunset_puresky_2k.hdr'
}

// This constant 'hdrTexture' is declared to hold the loaded HDR texture. 
// It is assigned the value returned by the 'loadHDRITexture' function.

export const hdrTexture = loadHDRITexture();

// This function 'addHDRIToThreebox' is defined to add the loaded HDR texture to a Threebox scene.
// It takes 'tb' (a Threebox instance) and 'hdrTexture' (the loaded HDR texture) as parameters.

export function addHDRIToThreebox(tb, hdrTexture) {
  // Create an AmbientLight with color 0x404040 (dark gray) and intensity 3
  const light = new AmbientLight(0x404040, 3); // soft white light
  tb.add(light); // Add the light to the Threebox scene

  // Set the mapping of the HDR texture to EquirectangularReflectionMapping
  hdrTexture.mapping = EquirectangularReflectionMapping;

  // Set the environment of the Threebox scene to the loaded HDR texture
  tb.scene.environment = hdrTexture;
}


export function getScaleFromZoom(zoom) {
  const inputValue = zoom; // Replace with your input value
  const inputMin = 1; // Max min zoom goes under inputmin max
  const inputMax = 18.1;
  const outputMin = 0.0000125; // Dont change output values
  const outputMax = 4;
  const convertedValue = mapRange(
    inputValue,
    inputMin,
    inputMax,
    outputMin,
    outputMax,
  );

  if (devmode) console.log('converted: ', convertedValue);

  return convertedValue;
}

function copyStartingValue(arr, length) {
  if (arr.length === 0 || length <= 0) {
    return []; // Return an empty array if the input array is empty or length is non-positive
  }

  const startingValue = arr[0]; // Get the starting value of the input array
  const copiedArray = Array(length).fill(startingValue); // Create a new array with the starting value repeated for the specified length
  return copiedArray;
}

export function generate3DLine(
  coordinates,
  selectedTransport,
  tb,
  color = false,
) {
  const arc3DWorldVec3Array = generate3DLineData(
    coordinates,
    selectedTransport,
    tb,
  );

  const pathCurve = new CatmullRomCurve3(arc3DWorldVec3Array);

  console.log(pathCurve.points);

  if (color) {
    pathCurve.points.forEach((point, index) => {
      // Create a cube geometry
      const geometry = new BoxGeometry(0.05, 0.05, 0.05);
      // Create a material
      const randomColor = Math.random() * 0xffffff;

      const material = new MeshBasicMaterial({ color: randomColor });
      // Create a mesh with the geometry and material
      const cube = new Mesh(geometry, material);
      // Set the cube's position to the point on the curve
      cube.position.copy(point);
      // Add the cube to the scene
      tb.add(cube);
    });
  }

  const dynamicPath = copyStartingValue(
    pathCurve.points,
    pathCurve.points.length,
  );

  let pathGeometry = new Line();

  pathGeometry.setPoints(pathCurve.points);

  pathGeometry.setDrawRange(0, 0);

  let material;

  var colour = new Color('#FE7138');
  var hex = colour.getHex();

  const canvas = document.getElementsByClassName('maplibregl-canvas')[0];

  material = new LineBasicMaterial({
    color: hex,
    lineWidth: 5,
    resolution: new Vector2(canvas.clientWidth, canvas.clientHeight),
  });

  material.color.convertSRGBToLinear();

  material.transparent = true;

  return {
    material,
    pathCurve,
    pathGeometry,
    dynamicPath,
  };
}

export function generate3DLineData(
  coordinates,
  tb,
) {
  let arc3DPoints = [];


  for (let index = 0; index < coordinates.length; index++) {
    const coord = coordinates[index];
    // const easedValue = Easing.easeInOutQuad(index, 0, maxZ, halfSize);
    arc3DPoints.push([coord[0], coord[1], 0]);
  }
  // arc3DPoints = addInterpolatedPoints(coordinates, []);


  const arc3DWorldVec3Array = [];

  for (let i = 0; i < arc3DPoints.length; i++) {
    const dest = tb.projectToWorld(arc3DPoints[i]);
    arc3DWorldVec3Array.push(new Vector3(dest.x, dest.y, dest.z));
  }

  return arc3DWorldVec3Array;
}


