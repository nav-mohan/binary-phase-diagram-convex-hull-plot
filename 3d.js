import qh from 'https://cdn.jsdelivr.net/npm/quickhull3d@v3/+esm'

const points = [
[0, 1, 0],
[1, -1, 1],
[-1, -1, 1],
[0, -1, -1]
]

const faces = qh(points)
console.log(faces)
// output:
// [ [ 2, 1, 0 ], [ 3, 1, 2 ], [ 3, 0, 1 ], [ 3, 2, 0 ] ]
// 1st face:
//   points[2] = [-1, -1, 1]
//   points[1] = [1, -1, 1]
//   points[0] = [0, 1, 0]
//   normal = (points[1] - points[2]) x (points[0] - points[2])