//Vertex Shader Program
var VSHADER_SOURCE =
[
  'uniform mat4 vs_modelMatrix;',
  'uniform mat4 vs_viewMatrix;',
  'uniform mat4 vs_projectionMatrix;',
  '',
  'uniform float vs_one_colour;',
  '',
  'uniform vec4 vs_single_colour;',
  '',
  'attribute vec4 vs_point;',
  'attribute vec4 vs_colour;',
  'attribute vec3 vs_normal;',
  '',
  'uniform vec3 vs_light_point;',
  'uniform vec3 vs_light_colour;',
  'uniform float vs_light_ambient;',
  'uniform float vs_light_diffuse;',
  'uniform float vs_light_specular;',
  '',
  'varying vec4 fs_point;',
  '',
  'varying vec4 fs_colour;',
  'varying float fs_one_colour;',
  'varying vec4 fs_single_colour;',
  '',
  'varying vec3 fs_normal;',
  'varying vec3 fs_light_point;',
  'varying vec3 fs_light_colour;',
  '',
  'varying float fs_light_ambient;',
  'varying float fs_light_diffuse;',
  'varying float fs_light_specular;',
  '',
  'varying vec3 fs_view_point;',
  '',
  'void  main() {',
    'gl_Position = vs_projectionMatrix * vs_viewMatrix * vs_modelMatrix * vs_point;',
    '',
    'fs_point = vs_viewMatrix * vs_modelMatrix * vs_point;',
    '',
    'fs_colour = vs_colour;',
    'fs_one_colour = vs_one_colour;',
    'fs_single_colour = vs_single_colour;',
    '',
    'fs_normal = normalize(vec3(vs_viewMatrix * vs_modelMatrix * vec4(vs_normal, 0.0)));',
    '',
    'fs_light_point = vs_light_point;',
    'fs_light_colour = vs_light_colour;',
    '',
    'fs_light_ambient = vs_light_ambient;',
    'fs_light_diffuse = vs_light_diffuse;',
    'fs_light_specular = vs_light_specular;',
    '',
    'fs_view_point = -vec3(vs_viewMatrix * vec4(0.0, 0.0, 0.0, 1.0));',
    '}'
].join('\n');

//Fragment shader program
var FSHADER_SOURCE =
[
  'precision mediump float;',
  '',
  'varying vec4 fs_point;',
  '',
  'varying vec4 fs_colour;',
  '',
  'varying float fs_one_colour;',
  '',
  'varying vec4 fs_single_colour;',
  '',
  'varying vec3 fs_normal;',
  '',
  'varying vec3 fs_light_point;',
  'varying vec3 fs_light_colour;',
  '',
  'varying float fs_light_ambient;',
  'varying float fs_light_diffuse;',
  'varying float fs_light_specular;',
  '',
  'varying vec3 fs_view_point;',
  '',
  'void main() {',
  '',
    'vec4 light_colour = vec4(fs_light_colour, 1.0);',
    'vec3 light_delta = fs_light_point - fs_point.xyz;',
    'vec3 light_direction = normalize(light_delta);',
    '',
    'if (fs_one_colour > 0.5) {',
      'gl_FragColor = fs_single_colour;',
    '} else {',
      'float cosAngle = clamp(dot(light_direction, fs_normal), 0.0, 1.0);',
      'float cosReflect = clamp(dot(reflect(-light_direction, fs_normal), normalize(fs_view_point)), 0.0, 1.0);',
      '',
      'gl_FragColor =',
          'fs_light_ambient * fs_colour +',
          'fs_light_diffuse * fs_colour * light_colour * cosAngle +',
          'fs_light_specular * fs_colour * light_colour * pow(cosReflect, 5.0);',
          '',
      'gl_FragColor.w = fs_colour.w;',
    '}',
  '}'
].join('\n');

var main = function() {

	var bacOnCanvas = 5; //num of bacteria allowed to be on canvas at once
  var bacRemaining = 20; //total number of bacteria set to spawnBac
  var bacAlive = 0; //bacteria currently alive
  var poisonedBacteria = 0;
	var bacterium = [];
  var points = 0;
  var particlesArray = [];
  var thresholdCount = 0;
  var continuous = false;
  var gameOver = false;

  //Create main canvas
  var canvas = document.getElementById('webgl');

  //Get the rendering context for WebGL
  var gl = getWebGLContext(canvas);
  if (!gl) {
    console.log('Failed to get the rendering context for WebGL');
    return;
  }

  // store canvas dimentions
  var gameWidth = canvas.width;
  var gameHeight = canvas.height;
  
  //Lighting location and colour
  let lightPosition = vec3.fromValues(2.0, 2.0, 2.0);
  let lightColour = vec3.fromValues(1.0, 1.0, 1.0);

  //Initialize shaders
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to intialize shaders.');
    return;
  }

  //Set canvas colour
  gl.clearColor(0, 0, 0, 0);

  gl.enable(gl.DEPTH_TEST);

  //Uniforms and attributes to be used in following gl_environment initialization
  //Couldn't get it working using the .getUniform1f... etc 
  //Could be something worth trying to fix
  var uniforms = [
    "modelMatrix",
    "viewMatrix",
    "projectionMatrix",

    "one_colour",
    "single_colour",

    "light_point",
    "light_colour",

    "light_ambient",
    "light_diffuse",
    "light_specular",
  ];

  var attributes = [
    "point",
    "colour",
    "normal"
  ];

  //Create GL Environment
  //takes gl program, vertex shader, fragment shader, unfirom variables and attribute variables as arguments and create a webgl environment
  let gl_env = new GLEnvironment(gl, VSHADER_SOURCE, FSHADER_SOURCE, uniforms, attributes);

  gl.useProgram(gl_env.shader);
  
  gl.uniform1f(gl_env.uniforms.one_colour, 0.0);

  // Create centre sphere 
  //Sphere(gl, depth/resolution)
  let gameSurface = new Sphere(gl_env, 5);
  gameSurface.buildModel();
  gameSurface.createPointBuffer();
  gameSurface.createIndexBuffer();
  gameSurface.subdivide(gameSurface.depth);
  gameSurface.createColourBuffer();
  gameSurface.createNormalBuffer();
  gameSurface.loadPointBuffer();
  gameSurface.loadColourBuffer();
  gameSurface.loadIndexBuffer();
  gameSurface.loadNormalBuffer();

  // View matrix initialization
  let viewMatrix = mat4.create();
  mat4.lookAt(viewMatrix, [0.0, 0.0, 3.0], [0.0, 0.0, 0.0], [0.0, 1.0, 0.0]); //mat4(viewMatrix, [lookFrom], [lookAt], [up]) 

  //Projection matrix initialization
  let projectionMatrix = mat4.create()
  mat4.perspective(projectionMatrix, glMatrix.toRadian(60), gameWidth/gameHeight, 0.1, 100.0);

  // Create set of ids for the bacteria so we can keep track of them
  let bacIds = new Set();
  for (var i = 0; i < bacOnCanvas; i++) {
    bacIds.add(i+2); //modify addition integer to change how many spawnBac at a time
  }

  bacOnCanvas = bacIds.size;

  drawSphere();

  // drawShere Function
  function drawSphere() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.uniformMatrix4fv(gl_env.uniforms.viewMatrix, false, viewMatrix);
    gl.uniformMatrix4fv(gl_env.uniforms.projectionMatrix, false, projectionMatrix);
    
    gl.uniform3fv(gl_env.uniforms.light_point, lightPosition);
    gl.uniform3fv(gl_env.uniforms.light_colour, lightColour);

    //call to drawSphere function in Sphere class
    gameSurface.drawSphere();

    //Draw each bacteria
    bacterium.forEach(function(bac){bac.drawSphere();});
  }

  // Function to get the next id from the bacIds
  function getNextId() {
    let ids = Array.from(bacIds);
    let id = ids[Math.floor(Math.random() * ids.length)];

    bacIds.delete(id);
    return id;
  }

  // Function to spawn bacteria
  function spawnBac() {
    let radius = 0.05; //size of radius upon spawn

    //If bacterium length is less than the number of bacteria allowed on canvas, then spawn
    if (bacterium.length < bacOnCanvas) {
      //randomly select center
      let center = vec3.fromValues(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
      vec3.normalize(center, center);

      //get next id
      let id = getNextId();
      //get colour corresponding to current bacteria
      let colours = [
        vec4.fromValues((Math.random() * 300) , 1.0, 0.8 - 0.2 * (Math.random() * bacIds.size) % 2, 1.0),
        vec4.fromValues((Math.random() * 300), 1.0, 0.4 - 0.2 * (Math.random() * bacIds.size) % 2, 1.0)
      ]
      //spawn new bacteria
      let bacteria = new Sphere(gl_env, 5, center, radius, colours[0], colours[1], undefined, undefined, 0.02);
        bacteria.buildModel();
        bacteria.createPointBuffer();
        bacteria.createIndexBuffer();
        bacteria.subdivide(bacteria.depth);
        bacteria.createColourBuffer();
        bacteria.createNormalBuffer();
        bacteria.loadPointBuffer();
        bacteria.loadColourBuffer();
        bacteria.loadIndexBuffer();
        bacteria.loadNormalBuffer();
        bacteria.id = id;

        //increment bacteria avlie
        bacAlive++;
        //push bacteria to our bacterium array 
        bacterium.push(bacteria);
      }
  }

  // Function to grow bacteria on each tick
  function grow() {
    let growthFactor = 0.0005; //increase for more difficulty, decrease for less
    let inc = vec3.fromValues(growthFactor, growthFactor, growthFactor);
    let max = growthFactor *  5000;

    bacterium.forEach(function(bacteria){
      //if bacteria is still within the allowed limit
      if (bacteria.scale[0] < max) { 
        bacteria.radius += growthFactor;
        vec3.add(bacteria.scale, bacteria.scale, inc);
        bacteria.buildModel();
      }
      
      if(bacteria.radius >= 0.35) {
        // LOSING CONDITION
      }
    });
  }

  // play function
  function play() {

    // set the game mode
    document.getElementById("gameMode").addEventListener("click", function() {
      // change to continuous spawnBacs
      if(continuous == false && gameOver == false){
          continuous = true;
          // change button text
          document.getElementById("gameMode").innerHTML = "Continuous";
          // spawnBac up to max bacteria after game mode change
          while (currBacNum < bacOnCanvas){
              // create new bacteria
              bacteria.push(new Bacteria());
              bacteria[currBacNum].spawnBac();
          }
      }
    });

    // set text values for points and bacteria posioned
    document.getElementById('pointsText').innerHTML = "Points: " + points;
    document.getElementById('bactRemoved').innerHTML = "Bacteria Poisoned: " + poisonedBacteria;

    // game over, two have reached threshold
    if(thresholdCount >= 2){
      // remove remaining bacteria
      for (let b in bacteria){
          bacteria.splice(b,1);
          currBacNum--;
      }
      
      document.getElementById('pointsText').innerHTML = "Final Score: " + points;
      document.getElementById('bactRemoved').innerHTML = "Game Over!";
      
      // game has ended
      gameOver = true;
    }

    // if the player wins set final text
    if (poisonedBacteria == bacOnCanvas && continuous == false){
      document.getElementById('pointsText').innerHTML = "Final Score: " + points;
      document.getElementById('bactRemoved').innerHTML = "You Win!";
    }
    if(bacRemaining > 0 + bacAlive) {
      spawnBac();
    }
      spawnBac();
      grow();
      drawSphere();
      requestAnimationFrame(play);
    }
  play();
}

class Sphere {
  constructor(gl_env, depth, center, radius, colourStart, colourStop, 
    colourAmbient, colourDiffuse, colourSpecular) {
      this.gl_env = gl_env;
      this.depth = depth;
      this.center = center;
      this.radius = radius;
      this.colourStart = colourStart;
      this.colourStop = colourStop;
      this.colourAmbient = colourAmbient;
      this.colourDiffuse = colourDiffuse;
      this.colourSpecular = colourSpecular

      this.buffers = {}
      this.model = mat4.create();
      this.translation = center || vec3.create();
      this.scale = vec3.fromValues(1.0, 1.0, 1.0);
      this.rotation = mat4.create();
      this.id = 0;
      this.consuming = [];

      if (depth === undefined) depth = 5;

      if (radius !== undefined) vec3.set(this.scale, radius, radius, radius);

      this.colour_start = colourStart || vec4.fromValues(0.05, 0.1, 0.05, 1.0);
      this.colour_stop = colourStop || vec4.fromValues(0.05, 0.1, 0.05, 1.0);

      if (colourAmbient === undefined) colourAmbient = 0.3;
      if (colourDiffuse === undefined) colourDiffuse = 0.5;
      if (colourSpecular === undefined) colourSpecular = 0.5;

      this.colour_ambient = colourAmbient;
      this.colour_diffuse = colourDiffuse;
      this.colour_specular = colourSpecular;
    }
    
    buildModel() {
      this.model = mat4.create();
      mat4.translate(this.model, this.model, this.translation);
      mat4.scale(this.model, this.model, this.scale);
      mat4.mul(this.model, this.model, this.rotation);
    }

    createPointBuffer() {
      var gl_env = this.gl_env;
      var gl = gl_env.gl;
      var gl_buffer = gl.createBuffer();

      var buffer = [
        sphere_vector(0.0, 0.0),
        sphere_vector(0.0, Math.acos(-1.0/3.0)),
        sphere_vector(2.0 * Math.PI / 3.0, Math.acos(-1.0/3.0)),
        sphere_vector(4.0 * Math.PI / 3.0, Math.acos(-1.0/3.0)),
      ];

      this.buffers.points = {
        gl_buffer: gl_buffer,
        buffer: buffer
      }
    }

    loadPointBuffer() {
      var gl_env = this.gl_env;
      var gl = gl_env.gl;

      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.points.gl_buffer);
      gl.bufferData(gl.ARRAY_BUFFER, gl_vector_list(this.buffers.points.buffer),
                    gl.STATIC_DRAW);
    }

    createColourBuffer() {
      var gl_env = this.gl_env;
      var gl = gl_env.gl;
      var gl_buffer = gl.createBuffer();

      var colour_norm = vec4.fromValues(0.0, 0.0, 1.0, 0.0);

      var colour_difference = vec4.sub(vec4.create(),
                                      this.colour_stop, this.colour_start);

      var colour_matrix = mat4.create();
      for (var i = 0; i < 3; i++){
        colour_matrix[0 + i * 4] = colour_difference[0] * colour_norm[i];
        colour_matrix[1 + i * 4] = colour_difference[1] * colour_norm[i];
        colour_matrix[2 + i * 4] = colour_difference[2] * colour_norm[i];
      }

      colour_matrix[12] = this.colour_start[0];
      colour_matrix[13] = this.colour_start[1];
      colour_matrix[14] = this.colour_start[2];

      var m = mat4.create()

      mat4.scale(m, m , [0.5, 0.5, 0.5]);
      mat4.translate(m, m, [1.0, 1.0, 1.0]);
      mat4.mul(colour_matrix, colour_matrix, m);

      var buffer = [];

      this.buffers.points.buffer.forEach(function(point) {
          var colour = vec4.create();
          vec4.transformMat4(colour, point, colour_matrix);

          buffer.push(colour);
      }, this);

      this.buffers.colours = {
        gl_buffer: gl_buffer,
        buffer: buffer
      }
    }

    loadColourBuffer() {
      var gl_env = this.gl_env;
      var gl = gl_env.gl;

      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.colours.gl_buffer);
      gl.bufferData(gl.ARRAY_BUFFER, gl_vector_list(this.buffers.colours.buffer),
                                    gl.STATIC_DRAW);
    }

    createIndexBuffer() {
      var gl_env = this.gl_env;
      var gl = gl_env.gl;
      var gl_buffer = gl.createBuffer();

      var buffer = [];

      buffer.push(0, 2, 1);
      buffer.push(0, 1, 3);
      buffer.push(0, 3, 2);
      buffer.push(1, 2, 3);

      this.buffers.indices = {
        gl_buffer: gl_buffer,
        buffer: buffer
      }
    }

    loadIndexBuffer() {
      var gl_env = this.gl_env;
      var gl = gl_env.gl;

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.indices.gl_buffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,
                    new Uint16Array(this.buffers.indices.buffer), gl.STATIC_DRAW);
    }

    createNormalBuffer() {
      var gl_env = this.gl_env;
      var gl = gl_env.gl;

      var gl_buffer = gl.createBuffer();
      var buffer = [];

      this.buffers.points.buffer.forEach(function(point){
        buffer.push(vec3.clone(point));
      }, this);

      this.buffers.normals = {
        gl_buffer: gl_buffer,
        buffer: buffer
      };
    }

    loadNormalBuffer() {
      var gl_env = this.gl_env;
      var gl = gl_env.gl;

      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.normals.gl_buffer);
      gl.bufferData(gl.ARRAY_BUFFER, gl_vector3_list(this.buffers.normals.buffer),
                    gl.STATIC_DRAW);
    }

    subdivide = function(depth) {
      if (depth == 0) return;

      var points = this.buffers.points.buffer;
      var indices = this.buffers.indices.buffer;

      var new_points = new Map();

      function get_index(a, b) {
        if (new_points.has([a, b])) {
          return new_points.get([a, b]);
        } else {
          var vec = vec4.create()
          vec[3] = 1.0;
          vec3.lerp(vec, points[a], points[b], 0.5);
          vec3.normalize(vec, vec);

          var index = points.length;

          points.push(vec);

          new_points.set([a, b], index);
          new_points.set([b, a], index);
          return index;
        }
      }

      var new_indices = [];

      for(var i = 0; i < indices.length; i += 3) {

        var a = indices[i + 0];
        var b = indices[i + 1];
        var c = indices[i + 2];

        var ab = get_index(a, b);
        var bc = get_index(b, c);
        var ca = get_index(c, a);

        new_indices.push(a, ab, ca);
        new_indices.push(b, bc, ab);
        new_indices.push(c, ca, bc);
        new_indices.push(ab, bc, ca);

      }

      this.buffers.indices.buffer = new_indices;

      this.subdivide(depth - 1);
    }

    drawSphere = function() {
      var gl_env = this.gl_env;
      var gl = gl_env.gl;

      gl.uniform1f(gl_env.uniforms.light_ambient, this.colour_ambient);
      gl.uniform1f(gl_env.uniforms.light_diffuse, this.colour_diffuse);
      gl.uniform1f(gl_env.uniforms.light_specular, this.colour_specular);

      gl.uniform4fv(gl_env.uniforms.single_colour, vec4.fromValues(Math.random * 255, Math.random * 255, Math.random * 255, 1.0));

      gl.uniformMatrix4fv(gl_env.uniforms.modelMatrix, false,
                          new Float32Array(this.model));

      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.points.gl_buffer);
      gl.vertexAttribPointer(gl_env.attributes.point, 4, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.colours.gl_buffer);
      gl.vertexAttribPointer(gl_env.attributes.colour, 4, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.normals.gl_buffer);
      gl.vertexAttribPointer(gl_env.attributes.normal, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.indices.gl_buffer);
      gl.drawElements(gl.TRIANGLES, this.buffers.indices.buffer.length,
                      gl.UNSIGNED_SHORT, 0);
    }
}