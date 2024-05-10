import {
    point,
    lineString,
    nearestPointOnLine,
} from '@turf/turf';
import { BufferGeometry, Mesh, Quaternion, Vector3 } from 'three';
import { generate3DLine, getScaleFromZoom } from './utils';


class AnimationController {
    constructor(map, model, route) {
        if (!map) return;
        this.map = map;
        this.tb = window.tb;
        if (model) this.model = model;
        this.pathGeometry = new BufferGeometry();

        this.pathLineString = route;
        this.lineData = route.coordinates;
    }

    set3DPath() {
        // Generates a 3D path mesh based on provided data and parameters
        const pathMesh = generate3DLine(
            this.lineData,                   // Data defining the line
            this.selectedTransport,         // Selected transport type
            this.tb,                        // Some tb object
            this.shouldAnimatePath,        // Boolean indicating whether path should be animated
        );

        // Copies starting value of line data
        const dynamicPath = this.copyStartingValue(
            this.lineData,                 // Original line data
            this.lineData.length,         // Length of line data
        );

        // Assigns generated path components to object properties
        this.pathCurve = pathMesh.pathCurve;
        this.material = pathMesh?.material;
        this.pathGeometry = pathMesh?.pathGeometry;

        // Stores dynamic path data
        this.dynamicPath = dynamicPath;
    }


    updateLineString(updatedCoordinates) {
        // Updates the line string data on the map
        let id = 'route';
        const source = this.map.getSource(id)
        const line = lineString(updatedCoordinates);

        if (source) source.setData(line);
    }

    setVelocityFOrCar() {
        // Calculates velocity for the car animation based on path length and time
        const points = this.pathLineString.coordinates.length;

        // Sets a fixed time for animation chunk
        this.timeForChunk = 10000;

        // Calculates velocity based on path length and time
        const velocity = points / this.timeForChunk;

        // Calculates total animation time based on velocity
        this.time = points / velocity;
    }

    startAnimation() {
        // Set initial velocity for car
        this.setVelocityFOrCar();

        // Initialize variables for animation
        this.totalTime = 0; // Total time passed during animation
        this.lastIndex = 0; // Index of last point processed in animation
        this.pathMesh = new Mesh(this.pathGeometry, this.material); // Create path mesh for visualization
        this.tb.add(this.pathMesh); // Add path mesh to Three.js scene
        this.setupAnimation(); // Begin setting up animation
    }

    setupAnimation() {
        // Make model visible if it's not already
        if (!this.model.visible) {
            this.model.visible = true;
        }

        // Calculate desired scale for model based on current map zoom
        const zoom = this.map.getZoom();
        const desiredScale = getScaleFromZoom(zoom);
        this.model.scale.set(desiredScale, desiredScale, desiredScale);

        // Record start time and duration for animation
        const now = performance.now();
        this.animationStartTime = now;
        this.animationDuration = 10000; // 10 seconds
        this.animationEndTime = now + this.animationDuration; // Calculate end time of animation
        this.isAnimationExpired = false; // Flag to indicate if animation has ended

        // Log information about the line data for debugging
        console.log('Number of Points:', this.lineData.length);
        console.log(
            'Points/Time:',
            this.lineData.length / (this.time / 1000),
        );

        // Set up interval to log animation progress every second
        let time = 1; // Initialize time counter
        const interval = setInterval(() => {
            // Check if animation has ended
            if (this.isAnimationExpired) {
                clearInterval(interval); // If animation has ended, stop the interval
            } else {
                // Log elapsed time and number of points moved since last interval
                console.log(
                    'Seconds passed:',
                    time + ' sec',
                );
                console.log(
                    'Points Moved:',
                    this.index - this.lastIndex,
                );
                time += 1; // Increment time counter
                this.lastIndex = this.index; // Update last index processed
            }
        }, 1000); // Interval set to 1 second
    }


    // Function to get the position along a path at a given progression
    getPosition(path, tp) {
        // Get the length of the path
        const len = path.length;
        // Calculate the total points reached based on progression
        const pointsFromTP = len * tp;
        // Calculate the index of the current position on the path
        const index = Math.floor(pointsFromTP);

        // Check if animation is complete
        if (index >= len - 1) {
            // Animation is complete, return the last position
            const lastCoord = path[len - 1];
            const dest = this.tb.projectToWorld([lastCoord[0], lastCoord[1], 0]);
            let position = new Vector3(dest.x, dest.y, dest.z);

            return { position, coord: lastCoord, pointsindex: len - 1 };
        } else {
            // Animation is still in progress, get the position along the path
            const coord = path[index];
            let lnglatPos = [coord[0], coord[1], 0];
            const dest = this.tb.projectToWorld(lnglatPos);
            let position = new Vector3(dest.x, dest.y, dest.z);

            return { position, coord, pointsindex: index };
        }
    }

    // Function to get the next position on the path
    getNextPosition(index, path) {
        const len = path.length;

        // Check if animation is complete
        if (index >= len - 1) {
            // Animation is complete, return the last position
            const lastCoord = path[len - 1];
            const dest = this.tb.projectToWorld([lastCoord[0], lastCoord[1], 0]);
            let position = new Vector3(dest.x, dest.y, dest.z);

            return { position };
        }

        // Get the position along the path
        const coord = path[index];
        let lnglatPos = [coord[0], coord[1], 0];
        const dest = this.tb.projectToWorld(lnglatPos);
        let position = new Vector3(dest.x, dest.y, dest.z);

        return { position };
    }

    // Function to update the path line based on the current position
    updatePathLine(
        position,
        pathPoints,
    ) {
        // If there are no path points, return an empty array
        if (pathPoints.length === 0) {
            return [];
        }

        // Convert path points to a line
        var line = lineString(pathPoints);
        // Convert current position to a point
        var myPoint = point(position);

        // Calculate the closest point on the line to the current position
        var closestPoint = nearestPointOnLine(line, myPoint);

        // Get the index of the closest point on the line
        let closestIndex = closestPoint.properties.index;

        // Create a new array to update the path line
        const newArray = [
            // Add points from the start of the path to the closest point
            ...pathPoints.slice(0, closestIndex + 1),
            // Fill the rest of the array with the current position
            ...new Array(pathPoints.length - closestIndex - 1).fill(position),
        ];

        return newArray;
    }

    animate() {
        // Check if animation is not expired
        if (!this.isAnimationExpired) {
            // Get current timestamp
            let now = performance.now();
            // Calculate time elapsed since animation start
            let timeElapsed = now - this.animationStartTime;
            // Store elapsed time in a variable
            this.timeEla = now - this.animationStartTime;
            // Get total animation time
            let totalAnimationTimeToUse = this.time;

            // Calculate progress of animation
            let timeProgress = timeElapsed / totalAnimationTimeToUse;

            // Apply easing function to time progress (not implemented in this code)
            let easedTimeProgress = timeProgress;

            // Check if animation is not completed
            if (easedTimeProgress <= 1) {
                // Get position, coordinate, and point index based on eased time progress
                const { position, coord, pointsindex } = this.getPosition(
                    this.lineData,
                    easedTimeProgress,
                );

                // Update current point index
                this.index = pointsindex;

                // Move the model along the path
                position.z += 0.15;
                this.model.position.copy(position);

                // Get next position along the path
                const nextPosition = this.getNextPosition(
                    pointsindex + 2,
                    this.lineData,
                );

                // Move next position along the z-axis
                nextPosition.position.z += 0.15;

                // Copy current model quaternion
                let q1 = new Quaternion().copy(this.model.quaternion);

                // Calculate world position of next point
                const worldPos = this.pathMesh.localToWorld(nextPosition.position);

                // Make the model look at the next point
                this.model.lookAt(worldPos);
                // Copy quaternion of the model after looking at the next point
                let q2 = new Quaternion().copy(this.model.quaternion);

                // Interpolate between the two quaternions to smoothly rotate the model
                this.model.quaternion.slerpQuaternions(q1, q2, 0.9);

                // Update dynamic path line
                this.dynamicPath = this.updatePathLine(
                    coord,
                    this.lineData,
                );

                // Update the line based on the dynamic path
                this.updateLineString(this.dynamicPath);

            } else {
                // Mark animation as completed
                this.isAnimationExpired = true;
                console.log('Animation completed!');
            }
        }
    }

}

export { AnimationController };
