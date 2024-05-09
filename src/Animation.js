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
        const pathMesh = generate3DLine(
            this.lineData,
            this.selectedTransport,
            this.tb,
            this.shouldAnimatePath,
        );

        const dynamicPath = this.copyStartingValue(
            this.lineData,
            this.lineData.length,
        );

        this.pathCurve = pathMesh.pathCurve;
        this.material = pathMesh?.material;
        this.pathGeometry = pathMesh?.pathGeometry;

        this.dynamicPath = dynamicPath;
    }

    updateLineString(updatedCoordinates) {
        let id = 'route';
        const source = this.map.getSource(id)
        const line = lineString(updatedCoordinates);

        if (source) source.setData(line);
    }

    setVelocityFOrCar() {
        const points = this.pathLineString.coordinates.length;

        this.timeForChunk = 10000;

        const velocity = points / this.timeForChunk;

        this.time = points / velocity;
    }

    startAnimation() {
        this.setVelocityFOrCar()
        this.totalTime = 0
        this.lastIndex = 0
        this.pathMesh = new Mesh(this.pathGeometry, this.material);

        this.tb.add(this.pathMesh);

        this.startPlaneAnimation();
    }

    startPlaneAnimation() {
        if (!this.model.visible) {
            this.model.visible = true;
        }
        const zoom = this.map.getZoom();
        const desiredScale = getScaleFromZoom(zoom);

        this.model.scale.set(desiredScale, desiredScale, desiredScale);

        const now = performance.now();
        this.animationStartTime = now;
        this.animationDuration = 10000;
        this.animationEndTime = now + this.animationDuration;
        this.isAnimationExpired = false;

        console.log('Number of Points:', this.lineData.length);
        console.log(
            'Points/Time:',
            this.lineData.length / (this.time / 1000),
        );

        let time = 1
        const interval = setInterval(() => {
            if (this.isAnimationExpired) {
                clearInterval(interval)
            }
            else {
                console.log(
                    'Seconds passed:',
                    time + ' sec',
                );
                console.log(
                    'Points Moved:',
                    this.index - this.lastIndex,
                );
                time += 1
                this.lastIndex = this.index
            }
        }, 1000);
    }

    getPosition(path, tp) {
        const len = path.length;
        const pointsFromTP = len * tp;
        const index = Math.floor(pointsFromTP);

        if (index >= len - 1) {
            // Animation is complete, return the last position
            const lastCoord = path[len - 1];
            const dest = this.tb.projectToWorld([lastCoord[0], lastCoord[1], 0]);
            let position = new Vector3(dest.x, dest.y, dest.z);

            return { position, coord: lastCoord, pointsindex: len - 1 };
        } else {
            const coord = path[index];

            let lnglatPos = [coord[0], coord[1], 0];

            const dest = this.tb.projectToWorld(lnglatPos);
            let position = new Vector3(dest.x, dest.y, dest.z);

            return { position, coord, pointsindex: index };
        }
    }

    getNextPosition(index, path) {
        const len = path.length;

        if (index >= len - 1) {
            // Animation is complete, return the last position
            const lastCoord = path[len - 1];
            const dest = this.tb.projectToWorld([lastCoord[0], lastCoord[1], 0]);
            let position = new Vector3(dest.x, dest.y, dest.z);

            return { position };
        }

        const coord = path[index];

        let lnglatPos = [coord[0], coord[1], 0];

        const dest = this.tb.projectToWorld(lnglatPos);
        let position = new Vector3(dest.x, dest.y, dest.z);

        return { position };
    }

    updatePathLine(
        position,
        pathPoints,
    ) {
        if (pathPoints.length === 0) {
            return [];
        }

        var line = lineString(pathPoints);
        var myPoint = point(position);

        // Calculate the closest point
        var closestPoint = nearestPointOnLine(line, myPoint);

        let closestIndex = closestPoint.properties.index;

        const newArray = [
            ...pathPoints.slice(0, closestIndex + 1),
            ...new Array(pathPoints.length - closestIndex - 1).fill(position),
        ];

        return newArray;
    }

    animate() {
        if (!this.isAnimationExpired) {
            let now = performance.now();
            let timeElapsed = now - this.animationStartTime;
            this.timeEla = now - this.animationStartTime;
            let totalAnimationTimeToUse = this.time;

            let timeProgress = timeElapsed / totalAnimationTimeToUse;

            let easedTimeProgress = timeProgress;

            if (easedTimeProgress <= 1) {
                const { position, coord, pointsindex } = this.getPosition(
                    this.lineData,
                    easedTimeProgress,
                );

                this.index = pointsindex

                // if (!this.totalTime || timeEla - this.totalTime > 900) {
                //     this.totalTime = timeEla;

                //     console.log(
                //         'Seconds passed:',
                //         Math.floor(timeEla / 1000) + 'sec',
                //         'Points Moved:',
                //         pointsindex - this.lastIndex,
                //         'pts',
                //     );
                //     this.lastIndex = pointsindex;

                // }
                // else if (timeEla === this.time) {
                //     console.log(
                //         'Seconds passed:',
                //         (timeEla / 1000) + 'sec',
                //         'Points Moved:',
                //         pointsindex - this.lastIndex,
                //         'pts',
                //     );
                // }

                // console.log(timeEla);
                position.z += 0.15;

                this.model.position.copy(position);

                const nextPosition = this.getNextPosition(
                    pointsindex + 2,
                    this.lineData,
                );

                nextPosition.position.z += 0.15;

                let q1 = new Quaternion().copy(this.model.quaternion);
                const worldPos = this.pathMesh.localToWorld(nextPosition.position);

                this.model.lookAt(worldPos);
                let q2 = new Quaternion().copy(this.model.quaternion);

                this.model.quaternion.slerpQuaternions(q1, q2, 0.9);

                this.dynamicPath = this.updatePathLine(
                    coord,
                    this.lineData,
                );

                this.updateLineString(this.dynamicPath);

            } else {
                this.isAnimationExpired = true;
                console.log('Animation completed!');
            }
        }
    }
}

export { AnimationController };
