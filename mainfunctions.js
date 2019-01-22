/* Copyright 2019 Jonathan (Jon) DuBois */

/* Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: */

/* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. */

/* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE. */

{
	var s = document.querySelector("script#mainfunctions.lnz");
	var machine = new Object();
	s.exp = machine;

	// Passthrough
	machine.passthroughVertex =
		"#version 300 es\n" +
		"precision highp float;\n" +
		"precision highp int;\n" +
		"\n" +
		"const vec4 square[ 4 ] = vec4[](\n" +
		"vec4( 1.0, 1.0, 0.0, 1.0 ),\n" +
		"vec4( -1.0, 1.0, 0.0, 1.0 ),\n" +
		"vec4( 1.0, -1.0, 0.0, 1.0 ),\n" +
		"vec4( -1.0, -1.0, 0.0, 1.0 ) );\n" +
		"\n" +
		"out vec2 posn;\n" +
		"\n" +
		"void main(){\n" +
		"gl_Position = square[ gl_VertexID & 3 ];\n" +
		"posn = ( gl_Position.xy + vec2( 1.0 ) ) / vec2( 2.0 );\n" +
		"}\n";
	machine.passthroughFragment = 
		"#version 300 es\n" +
		"precision highp float;\n" +
		"precision highp int;\n" +
		"\n" +
		"in vec2 posn;\n" +
		"\n" +
		"uniform sampler2D colorbuffer;\n" +
		"layout( location = 0 ) out vec4 color;\n" +
		"\n" +
		"void main(){\n" +
		"color = texture( colorbuffer, posn );\n" +
		"}\n";
	
	// Util
	machine.genShaders = function( shaders, thisp ){
		var sa = thisp._syntaxArrays;
		const pre = "#version 300 es\nprecision highp float;" +
					"\nprecision highp int;\n\n";
		shaders.fragment = shaders.vertex = ""
		shaders.header += "\n";
		var texouts = new Array();
		for( var i = 0; i < sa.length; ++i ){
			var type = machine.glslPrefix( sa[ i ][ 1 ][ 0 ].substring( 1, 4 ) )
					+ " ";
			var name = sa[ i ][ 0 ];
			if( name[ 0 ] == "*" ){
				var n = name.substring( 1 );
				if( n[ 0 ] == "#" ){
					n = n.substring( 1 );
				}
				var out = new Object;
				out.tex = n;
				out.type = type;
				texouts.push( out );
			}
			if( name[ 0 ] == "@" ){
				name = name.substring( 1 );
				shaders.fragmentHeader += "in " + type + name + ";\n";
				shaders.vertexHeader += "out " + type  + name + ";\n";
				type = "";
			}
			if( machine.names[ name ] ){
				type = "";
				name = machine.names[ name ].name;
			}
			if( sa[ i ][ 1 ][ 0 ][ 3 ] == "f" ){	
				shaders.fragment += type + name + " = "
					+ sa[ i ][ 1 ][ 0 ].value + ";\n";
			}else if( sa[ i ][ 1 ][ 0 ][ 3 ] == "v" ||
								sa[ i ][ 1 ][ 0 ][ 3 ] == "a" ){	
				shaders.vertex += type + name + " = " + sa[ i ][ 1 ][ 0 ].value
					+ ";\n";
			}
		}

		shaders.fragmentHeader += "\nlayout( location = 0 ) out vec4 color;\n";
		for( var i = 0; i < texouts.length; ++i ){
			shaders.fragmentHeader += "layout( location = " + ( i + 1 ) + " ) out "
				+ texouts[ i ].type + " " +	texouts[ i ].tex + ";\n";
		}
		
		shaders.fragment = pre + shaders.header +
			shaders.fragmentHeader + "\nvoid main(){\n" + shaders.fragment +
			shaders.fragmentFooter + "}";
		if( shaders.vertex == "" ){
			shaders.header += "const vec4 square[ 4 ] = vec4[](\n"
				+ "vec4( 1.0, 1.0, 0.0, 1.0 ),\n"
				+ "vec4( -1.0, 1.0, 0.0, 1.0 ),\n"
				+ "vec4( 1.0, -1.0, 0.0, 1.0 ),\n"
				+ "vec4( -1.0, -1.0, 0.0, 1.0 ) );\n";
			shaders.vertex = "gl_Position = square[ gl_VertexID & 3 ];\n";
		}
		shaders.vertex = pre + shaders.header +
			shaders.vertexHeader + "\nvoid main(){\n" + shaders.vertex +
			shaders.vertexFooter + "}";
	}
	// Returns a string of glsl, optionally modifying shaders.
	machine.getGlsl = function( val, type, shaders, thisp ){
		var isarray = val instanceof Int32Array || val instanceof Float32Array;
		if( typeof( val ) === "string" || typeof( val ) == "object"
				&& !isarray ){
			if( machine.values[ val ] && machine.values[ val ].trigger ){
				if( !thisp.triggered.has( machine.values[ val ].trigger ) ){
					machine.values[ val ].trigger( shaders, thisp );
					thisp.triggered.add( machine.values[ val ].trigger );
				}
			}
			if( type.substring( 2, 3 ) == "a" ){
				return val.substring( 1 );
			}else{
				var ans = val;
				if( machine.names[ val ] ){
					ans = machine.names[ val ].name;
				}
				return ans;
			}
		}else if( isarray ){
			var type = "";
			if( val instanceof Int32Array ){
				type = "i";
			}
			var nums = "";
			for( var i = 0; i < val.length; ++i ){
				var comma = i == 0 ? "" : ", ";
				if( type == "i" ){
					nums += comma + val[ i ];
				}else{
					var v = val[ i ].toString();
					if( !v.includes( "." ) ){
						v = v + ".0"; 
					}
					nums += comma + v;
				}
			}
			var ans;
			if( val.length == 1 ){
				ans = nums;
			}else{
				ans = type + machine.glslPrefix( val.length ) + "( " + nums + " )";
			}
			return ans;
		}else if( val instanceof Function ){
			var l = "u" + thisp._thunks.length.toString();
			{
				thisp._uniformTypes[ l ] = type;
				thisp._thunks.push( function(){
					thisp._uniforms[ l ] = val();
				});
				shaders.header += "uniform " + machine.glslPrefix( type )
					+ " " + l + ";\n";
			}
			return l;
		}else{
			//BUGBUG
			machine.info("BORKBORKBORK" + typeof( val ) + " fofo " + JSON.stringify( val ) );
		}
	}
	machine.glslPrefix = function( val ){
		if( typeof( val ) == "number" ){
			switch( val ){
			case 2:
				return "vec2";
			case 3:
				return "vec3";
			case 4:
				return "vec4";
			case 9:
				return "mat3";
			case 16:
				return "mat4";
			}
		}else{
			var c = Number.parseInt( val.substring( 0, 1 ) );
			var type = "";
			var scl = "float";
			if( val.substring( 1, 2 ) == "i" ){
				type = "i";
				scl = "int";
			}
			switch( c ){
			case 1:
				return scl;
			case 2:
				return type + "vec2";
			case 3:
				return type + "vec3";
			case 4:
				return type + "vec4";
			case 9:
				return "mat3";
			case 6:
				return "mat4";
			}
		}
	}
	machine.getVariability = function( types ){
		var ans = "c";
		types.forEach( function( e ){
			var c = e.substring( 2, 3 );
			if( c == "a" ){
				c = "f";
			}
			if( c == "f" || c == "v" ){
				if( ans != "c" && ans != "u" && ans != c ){
					var e = new Object();
					e.error = "Mixing of fragment and vertex variables";
					throw e;
				}
				ans = c;
			}else if( c == "u" && ans != "f" && ans != "v" ){
				ans = "u";
			}
		});
		return ans;	
	}

	
	
	machine.functions = new Object();

	machine.functions[ "+" ] = new Object();
	machine.functions[ "+" ].type = function( types ){
		var ans = new String();
		if( types.length != 2 ){
			ans.error = "Wrong number of arguments to binary operator:";
			return ans;
		}
		if( types[ 0 ].substring( 0, 2 ) != types[ 1 ].substring( 0, 2 ) ){
			ans.error = "Arguments not of same type, type " + types[ 0 ] +
				" and " + types[ 1 ] + ":";
			return ans;
		}
		ans = types[ 0 ].substring( 0, 2 ) + machine.getVariability( types );
		return ans;
	}
	{
		function binop( op, x, y ){
			var nop;
			switch( op ){
			case "+": nop = function( x, y ){ return x + y }; break;
			case "-": nop = function( x, y ){ return x - y }; break;
			case "*": nop = function( x, y ){ return x * y }; break;
			case "/": nop = function( x, y ){ return x / y }; break;
			}
			var ans = new Array();
			for( var i = 0; i < x.length; ++i ){
				ans.push( nop( x[ i ], y[ i ] ) );
			}
			if( x instanceof Float32Array ){
				return new Float32Array( ans );
			}else if( x instanceof Int32Array ){
				return new Int32Array( ans );
			}
		}
		function binopglsl( op, x, y ){
			return( "( " + x + " " + op + " " + y + " )" );
		}
		
		machine.functions[ "+" ].eval = function( vals ){
			return binop( "+", vals[ 0 ], vals[ 1 ] );
		}		
		machine.functions[ "+" ].glsl = function( glsls, types ){
			return binopglsl( "+", glsls[ 0 ], glsls[ 1 ] );
		}
		machine.functions[ "*" ] = new Object();
		Object.assign( machine.functions[ "*" ], machine.functions[ "+" ] );
		machine.functions[ "*" ].eval = function( vals ){
			return binop( "*", vals[ 0 ], vals[ 1 ] );
		}
		machine.functions[ "*" ].glsl = function( glsls, types ){
			return binopglsl( "*", glsls[ 0 ], glsls[ 1 ] );
		}
		machine.functions[ "/" ] = new Object();
		Object.assign( machine.functions[ "/" ], machine.functions[ "+" ] );
		machine.functions[ "/" ].eval = function( vals ){
			return binop( "/", vals[ 0 ], vals[ 1 ] );
		}
		machine.functions[ "/" ].glsl = function( glsls, types ){
			return binopglsl( "/", glsls[ 0 ], glsls[ 1 ] );
		}
		machine.functions[ "-" ] = new Object();
		Object.assign( machine.functions[ "-" ], machine.functions[ "+" ] );
		machine.functions[ "-" ].eval = function( vals ){
			return binop( "-", vals[ 0 ], vals[ 1 ] );
		}
		machine.functions[ "-" ].glsl = function( glsls, types ){
			return binopglsl( "-", glsls[ 0 ], glsls[ 1 ] );
		}
	}
	machine.functions[ "&" ] = new Object();
	machine.functions[ "&" ].type = function( types ){
		var ans = new String();
		if( types.length != 2 ){
			ans.error = "Wrong number of arguments to binary operator:";
			return ans;
		}
		if( types[ 0 ].substring( 0, 2 ) != types[ 1 ].substring( 0, 2 ) ){
			ans.error = "Arguments not of same type:";
			return ans;
		}
		if( types[ 0 ].substring( 1, 2 ) != "i" ){
			ans.error = "Float values given to bitwise operator:";
			return ans;
		}
		ans = types[ 0 ].substring( 0, 2 ) + machine.getVariability( types );
		return ans;
	}
	machine.functions[ "&" ].glsl = function( glsls, types ){
		return "( " + glsls[ 0 ] + " & " + glsls[ 1 ] + " )";
	}
	machine.functions[ "&" ].eval = function( vals ){
		var ans = new Int32Array( vals[ 0 ].length );
		for( var i = 0; i < vals[ 0 ].length; ++i ){
			ans[ i ] = vals[ 0 ][ i ] & vals[ 1 ][ i ];
		}
		return ans;
	}
	machine.functions[ "|" ] = new Object();
	machine.functions[ "|" ].type = machine.functions[ "&" ].type;
	machine.functions[ "^" ] = new Object();
	machine.functions[ "^" ].type = machine.functions[ "&" ].type;
	machine.functions[ "Tofloat" ] = new Object();
	machine.functions[ "Tofloat" ].type = function( types ){
		if( types.length != 1 ){
			var ans = new Object();
			ans.error = "Wrong number of arguments to Tofloat:";
			return ans;
		}
		
		return types[ 0 ].substring( 0, 1 ) + "f" + types[ 0 ].substring( 2, 3 );	
	}
	machine.functions[ "Tofloat" ].glsl = function( glsls, types ){
		if( types[ 0 ].substring( 1, 2 ) == "f" ){
			return glsls[ 0 ];
		}else{
			var l = Number.parseInt( types[ 0 ].substring( 0, 1 ) );
			if( l == 6 ){
				l += 10;
			}
			if( l == 1 ){
				return "float( " + glsls[ 0 ] + " )";
			}else{
				return machine.glslPrefix( l ) + "( " + glsls[ 0 ] + " )";
			}
		}
	}
	machine.functions[ "Tofloat" ].eval = function( vals ){
		var ans = new Float32Array( vals[ 0 ].length );
		for( var i = 0; i < vals[ 0 ].length; ++i ){
			ans[ i ] = vals[ 0 ][ i ];
		}
		return ans;
	}
	machine.functions[ "Toint" ] = new Object();
	machine.functions[ "Toint" ].type = function( types ){
		if( types.length != 1 ){
			var ans = new Object();
			ans.error = "Wrong number of arguments to Toint:";
			return ans;
		}
		if( Number.parseInt( types[ 0 ].substring( 0, 1 ) ) > 4 ){
			var ans = new Object();
			ans.error = "No support for int matrices:"
			return ans;
		}
		return types[ 0 ].substring( 0, 1 ) + "i" + types[ 0 ].substring( 2, 3 );	
	}
	machine.functions[ "Toint" ].glsl = function( glsls, types ){
		if( types[ 0 ].substring( 1, 2 ) == "i" ){
			return glsls[ 0 ];
		}else{
			var l = Number.parseInt( types[ 0 ].substring( 0, 1 ) );
			if( l == 6 ){
				l += 10;
			}
			if( l == 1 ){
				return "int( " + glsls[ 0 ] + " )";
			}else{
				return "i" + machine.glslPrefix( l ) + "( " + glsls[ 0 ] + " )";
			}
		}
	}
	machine.functions[ "Toint" ].eval = function( vals ){
		var ans = new Int32Array( vals[ 0 ].length );
		for( var i = 0; i < vals[ 0 ].length; ++i ){
			ans[ i ] = vals[ 0 ][ i ];
		}
		return ans;
	}
	machine.functions[ "If" ] = new Object();
	machine.functions[ "If" ].type = function( types ){
		var ans = new Object();
		if( types.length != 3 ){
			ans.error = "Wrong number of arguments to If:";
			return ans;
		}
		if( types[ 1 ].substring( 0, 2 ) !=
				types[ 2 ].substring( 0, 2 ) ){
			ans.error = "If statement with different types in the true and false"
				+ " clauses:";
			return ans;
		}
		if( types[ 0 ].substring( 0, 1 ) != "1" ){
			ans.error = "Nonscalar used as boolean in If statement:";
			return ans;
		}
		ans = types[ 1 ].substring( 0, 2 ) + machine.getVariability( types );
		return ans;
	}
	machine.functions[ "If" ].glsl = function( glsls, types ){
		var zero = "0";
		if( types[ 0 ].substring( 1, 2 ) == "f" ){
			zero = "0.0";
		}
		return "( ( " + zero + " != " + glsls[ 0 ] + " ) ? " + glsls[ 1 ] + " : "
			+ glsls[ 2 ] + " )";
	}
	machine.functions[ "If" ].eval = function( vals ){
		if( vals[ 0 ][ 0 ] != 0 ){
			return vals[ 1 ];
		}else{
			return vals[ 2 ];
		}
	}
	machine.functions[ "Len" ] = new Object();
	machine.functions[ "Len" ].type = function( types ){
		var ans = new Object();
		if( types.length != 1 ){
			ans.error = "Wrong number of arguments to Len:";
			return ans;
		}
		if( types[ 0 ].substring( 1, 2 ) != "f" ){
			ans.error = "Len called on integer:";
			return ans;
		}
		let comps = Number.parseInt( types[ 0 ].substring( 0, 1 ) );
		if( comps > 4 ){
			ans.error = "Cannot get length of matrix:";
			return ans;
		}
		ans = "1f" + machine.getVariability( types );
		return ans;
	}
	machine.functions[ "Len" ].glsl = function( glsls, types ){
		return "length( " + glsls[ 0 ] + " )";
	}
	machine.functions[ "Len" ].eval = function( vals ){
		let x = 0;
		for( let i = 0; i < vals[ 0 ].length; ++i ){
			x += vals[ 0 ][ i ] * vals[ 0 ][ i ];
		}
		return new Float32Array( [ Math.sqrt( x ) ] );
	}
	machine.functions[ "Log" ] = new Object();
	machine.functions[ "Log" ].type = function( types ){
		var ans = new Object();
		if( types.length != 1 ){
			ans.error = "Wrong number of arguments to Log:";
			return ans;
		}
		if( types[ 0 ].substring( 1, 2 ) != "f" ){
			ans.error = "Log called on integer:";
			return ans;
		}
		let comps = Number.parseInt( types[ 0 ].substring( 0, 1 ) );
		if( comps != 1 ){
			ans.error = "Log called on nonscalar:";
			return ans;
		}
		ans = "1f" + machine.getVariability( types );
		return ans;
	}
	machine.functions[ "Log" ].glsl = function( glsls, types ){
		return "log( " + glsls[ 0 ] + " )";
	}
	machine.functions[ "Log" ].eval = function( vals ){
		return new Float32Array( [ Math.log( vals[ 0 ][ 0 ] ) ] );
	}
	machine.functions[ "%" ] = new Object();
	machine.functions[ "%" ].type = machine.functions[ "+" ].type;
	machine.functions[ "%" ].glsl = function( glsls, types ){
		return "mod( " + glsls[ 0 ] + ", " + glsls[ 1 ] + " )";
	}
	machine.functions[ "%" ].eval = function( vals ){
		let ans = new Array( vals[ 0 ].length );
		for( let i = 0; i < vals[ 0 ].length; ++i ){
			ans[ i ] = vals[ 0 ] % vals[ 1 ];
		}
		if( vals[ 0 ] instanceof Float32Array ){
			return new Float32Array( ans );
		}else if( vals[ 0 ] instanceof Int32Array ){
			return new Int32Array( ans );
		}
	}
	// Comparisons
	{
		function comptype( types ){
			var ans = new Object();
			if( types.length != 2 ){
				ans.error = "Wrong number of arguments to comparison:";
				return ans;
			}
			if( types[ 0 ].substring( 1, 2 ) !=
					types[ 1 ].substring( 1, 2 ) ){
				ans.error = "Inconsistent types in comparison:";
				return ans;
			}
			if( types[ 0 ].substring( 0, 1 ) != "1" ||
					types[ 1 ].substring( 0, 1 ) != "1" ){
				ans.error = "Attempt to compare nonscalars:";
				return ans;
			}
			return "1" + types[ 0 ].substring( 1, 2 ) +
				machine.getVariability( types );				
		}
		function compeval( op ){
			return function( vals ){
				var ans;
				switch( op ){
				case ">": ans = ( vals[ 0 ] > vals[ 1 ][ 0 ] ? 1 : 0 ); break;
				case ">=": ans = ( vals[ 0 ][ 0 ] >= vals[ 1 ][ 0 ] ? 1 : 0 ); break;
				case "<": ans = ( vals[ 0 ][ 0 ] < vals[ 1 ][ 0 ] ? 1 : 0 ); break;
				case "<=": ans = ( vals[ 0 ][ 0 ] <= vals[ 1 ][ 0 ] ? 1 : 0 ); break;
				case "=": ans = ( vals[ 0 ][ 0 ] == vals[ 1 ][ 0 ] ? 1 : 0 ); break;
				case "!=": ans = ( vals[ 0 ][ 0 ] != vals[ 1 ][ 0 ] ? 1 : 0 ); break;
				}
				if( vals[ 0 ] instanceof Float32Array ){
					return new Float32Array( [ ans ] );
				}else{
					return new Int32Array( [ ans ] );
				}
			}
		}
		function compglsl( op ){
			return function( glsls, types ){
				var gop = op;
				if( gop == "=" ){
					gop = "==";
				}
				var fext = "";
				if( types[ 0 ].substring( 1, 2 ) == "f" ){
					fext = ".0";
				}				
				return "( " + glsls[ 0 ] + " " + gop + " " + glsls[ 1 ] +
					" ? 1" + fext + " : 0" + fext + " )";
			}
		}
		machine.functions[ ">" ] = new Object();
		machine.functions[ ">" ].type = comptype;
		machine.functions[ ">" ].eval = compeval( ">" );
		machine.functions[ ">" ].glsl = compglsl( ">" );
		machine.functions[ ">=" ] = new Object();
		machine.functions[ ">=" ].type = comptype;
		machine.functions[ ">=" ].eval = compeval( ">=" );
		machine.functions[ ">=" ].glsl = compglsl( ">=" );
		machine.functions[ "<" ] = new Object();
		machine.functions[ "<" ].type = comptype;
		machine.functions[ "<" ].eval = compeval( "<" );
		machine.functions[ "<" ].glsl = compglsl( "<" );
		machine.functions[ "<=" ] = new Object();
		machine.functions[ "<=" ].type = comptype;
		machine.functions[ "<=" ].eval = compeval( "<=" );
		machine.functions[ "<=" ].glsl = compglsl( "<=" );
		machine.functions[ "=" ] = new Object();
		machine.functions[ "=" ].type = comptype;
		machine.functions[ "=" ].eval = compeval( "=" );
		machine.functions[ "=" ].glsl = compglsl( "=" );
		machine.functions[ "!=" ] = new Object();
		machine.functions[ "!=" ].type = comptype;
		machine.functions[ "!=" ].eval = compeval( "!=" );
		machine.functions[ "!=" ].glsl = compglsl( "!=" );
		
	}
	// Generate swizzle functions.
	{
		var st = "XYZW";
		var sa = [0];
		
		var next = function( a ){
			var i = 0;
			while( true ){
				if( i >= a.length ){
					a.push( 0 );
					return;
				}
				if( a[ i ] < 3 ){
					a[ i ] = a[ i ] + 1;
					return;
				}else{
					a[ i ] = 0;
					i += 1;
				}
			}
		}
		while( sa.length <= 4 ){
			var str = "";
			var maxi = 0;
			let sa2 = [...sa];
			for( var i = 0; i < sa2.length; ++i ){
				str += st[ sa2[ i ] ];
				if( sa2[ i ] > maxi ){
					maxi = sa2[ i ];
				}
			}
			machine.functions[ str ] = new Object();
			let imaxi = maxi;
			machine.functions[ str ].type = function( types ){
				var ans = new Object();
				if( types.length != 1 ){
					ans.error = "Wrong number of arguments to swizzle function:";
					return ans;
				}
				if( Number.parseInt( types[ 0 ].substring( 0, 1 ) ) <
						( imaxi + 1 ) ){
					ans.error = "Attempt to get nonexistent component:";
					return ans;
				}
				if( Number.parseInt( types[ 0 ].substring( 0, 1 ) ) > 4 ){
					ans.error = "Attempt to swizzle matrix:";
					return ans;
				}
				return sa2.length + types[ 0 ].substring( 1, 3 );
			}
			let istr = str;
			machine.functions[ str ].glsl = function( glsls, types ){
				return "( " + glsls[ 0 ] + "." + istr.toLowerCase() + " )"; 
			}
			machine.functions[ str ].eval = function( vals ){
				var ans = new Array();
				for( var i = 0; i < sa2.length; ++i ){
					ans.push( vals[ 0 ][ sa2[ i ] ] );
				}
				
				if( vals[ 0 ] instanceof Float32Array ){
					return new Float32Array( ans );
				}else if( vals[ 0 ] instanceof Int32Array ){
					return new Int32Array( ans );
				}
			}
			next( sa );
		}
		
	}
	
	machine.values = new Object();

	machine.values[ "Pi" ] = new Object();
	machine.values[ "Pi" ].type = "1fc";
	machine.values[ "Pi" ].value = new Float32Array( [ Math.PI ] );
	machine.values[ "Mouse" ] = new Object();
	machine.values[ "Mouse" ].type = "2fu";
	machine.values[ "Mouse" ].value = function( thisp ){
		var gm = thisp.getMouse();
		return new Float32Array( gm );
		
	}
	machine.values[ "MouseButtons" ] = new Object();
	machine.values[ "MouseButtons" ].type = "1iu";
	machine.values[ "MouseButtons" ].value = function( thisp ){
		var gm = thisp.getMouseButtons();
		return new Int32Array( [ gm ] );
		
	}
	machine.values[ "MouseClicks" ] = new Object();
	machine.values[ "MouseClicks" ].type = "1iu";
	machine.values[ "MouseClicks" ].value = function( thisp ){
		var gm = thisp.getMouseClicks();
		return new Int32Array( [ gm ] );
		
	}
	machine.values[ "MouseReleases" ] = new Object();
	machine.values[ "MouseReleases" ].type = "1iu";
	machine.values[ "MouseReleases" ].value = function( thisp ){
		var gm = thisp.getMouseReleases();
		return new Int32Array( [ gm ] );
		
	}
	machine.values[ "Aspect" ] = new Object();
	machine.values[ "Aspect" ].type = "1fu";
	machine.values[ "Aspect" ].value = function( thisp ){
		var gm = thisp.width / thisp.height;
		return new Float32Array( [ gm ] );
		
	}	
	machine.values[ "Pos" ] = new Object();
	machine.values[ "Pos" ].type = "4ff";
	machine.values[ "Pos" ].value = "gl_FragCoord";
	machine.values[ "Posn" ] = new Object();
	machine.values[ "Posn" ].type = "2ff";
	machine.values[ "Posn" ].value = "Posn";
	machine.values[ "Posn" ].trigger = function( shaders, thisp ){
		shaders.fragmentHeader += "in vec2 Posn;\n";
		shaders.vertexHeader += "out vec2 Posn;\n";
		shaders.vertexFooter += "Posn = ( gl_Position.xy + vec2( 1.0 ) ) / "
		+ "vec2( 2.0 );\n";
	}
	machine.values[ "Index" ] = new Object();
	machine.values[ "Index" ].type = "1iv";
	machine.values[ "Index" ].value = "gl_VertexID";

  machine.names = new Object();

	machine.names[ "Color" ] = new Object();
	machine.names[ "Color" ].type = function( t ){
		var ans = new String();
		if( t.substring( 0, 2 ) != "4f" ){
			ans.error = "Expected a 4 float vector for color:"
			return ans;
		}
		ans = t.substring( 0, 2 ) + "f";
		return ans;
	}
	machine.names[ "Color" ].name = "color";
	machine.names[ "TriangleStrip" ] = new Object();
	machine.names[ "TriangleStrip" ].type = function( t ){
		var ans = new String();
		if( t.substring( 0, 2 ) != "4f" ){
			ans.error = "Expected a 4 float vector for triangleStrip:"
			return ans;
		}
		if( t.substring( 2, 3 ) == "f" || t.substring( 2, 3 ) == "a" ){
			ans.error = "Attempt to use fragment variable in vertex shader:"
			return ans;
		}
		ans = t.substring( 0, 2 ) + "v";
		return ans;
	}
	machine.names[ "TriangleStrip" ].name = "gl_Position";
}
