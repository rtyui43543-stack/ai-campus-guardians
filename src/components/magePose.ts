import * as THREE from 'three';

export interface MageArticulation {
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftElbow: THREE.Group;
  rightElbow: THREE.Group;
  staff: THREE.Group;
}

interface MagePose {
  greeting?: number;
  cast?: number;
  windup?: number;
  defense?: number;
  sway?: number;
}

const armOrientation = new THREE.Quaternion();
const staffOrientation = new THREE.Quaternion();
const staffEuler = new THREE.Euler();

// Both sleeves point down along local -Y. Negative Z opens the left arm;
// positive Z opens the right. Elbows bend toward the camera, clear of the robe.
export function poseMage(rig: MageArticulation, {
  greeting = 0, cast = 0, windup = 0, defense = 0, sway = 0,
}: MagePose = {}) {
  rig.leftArm.rotation.set(-.12 - .18 * cast - .20 * defense, 0,
    -.24 - .35 * greeting - .42 * cast - .25 * defense);
  rig.leftElbow.rotation.set(-.18 - .20 * cast, 0,
    -.12 - .90 * greeting - .50 * cast - .55 * defense + .06 * sway * greeting);
  rig.rightArm.rotation.set(-.12 - .22 * cast - .20 * windup * (1 - cast), 0,
    .22 + .43 * cast);
  rig.rightElbow.rotation.set(-.32 - .30 * cast, 0, -.18 + .58 * cast);

  // The staff pivots at the grip, independently of the bent forearm. Its gem
  // stays upright at rest and points toward the opponent during the cast.
  armOrientation.multiplyQuaternions(rig.rightArm.quaternion, rig.rightElbow.quaternion);
  staffEuler.set(-.06, 0, -.34 - .68 * cast);
  staffOrientation.setFromEuler(staffEuler);
  rig.staff.quaternion.copy(armOrientation.invert()).multiply(staffOrientation);
}
