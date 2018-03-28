/* global d3 */

// init
var margin = {
  top: 20,
  right: 180,
  bottom: 30,
  left: 60
}
var selected = []
var groupby = 1000
var width = 1000 - margin.left - margin.right
var height = 500 - margin.top - margin.bottom
var color = d3.scale.category10()
var x, y0, y1, xAxis, y0Axis, y1Axis, emptyLine, line0, area0, svg, legend
var n = []
var dataUrl
var rawData
function init (w, h) {
  width = w
  height = h
  d3.select('svg').remove()
  x = d3.time.scale()
  .range([0, width])

  y0 = d3.scale.linear()
    .range([height, 0])

  y1 = d3.scale.linear()
    .range([height, 0])

  xAxis = d3.svg.axis()
    .scale(x)
    .orient('bottom')
    .tickFormat(d3.time.format('%H:%M:%S'))

  y0Axis = d3.svg.axis()
    .scale(y0)
    .orient('left')

  y1Axis = d3.svg.axis()
    .scale(y1)
    .orient('right')

  emptyLine = d3.svg.line()
    .x(function (d) {
      return x(new Date(+d.key))
    })
    .y(function (d) {
      return height
    })

  line0 = d3.svg.line()
    .x(function (d) {
      return x(new Date(+d.key))
    })
    .y(function (d) {
      return y0(d.values)
    })

  area0 = d3.svg.area()
    .x(function (d) {
      return x(d.timeStamp)
    })
    .y0(height)
    .y1(function (d) {
      return y1(d.allThreads)
    })

  svg = d3.select('.chart').append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
}

function change () {
  if (this.checked) {
    selected.push(+this.value)
    rescale()
    var aggr = d3.nest()
      .key(function (d) { return +Math.round(+d.timeStamp / groupby) * groupby })
      .rollup(function (v) { return d3.mean(v, function (d) { return d.elapsed }) })
      .entries(n[this.value].values)
    svg.append('path')
      .datum(aggr)
      .attr('class', 'line ' + this.id)
      .style('stroke', color(this.id))
      .attr('d', emptyLine)
      .transition()
      .attr('d', line0)
  } else {
    selected.splice(selected.indexOf(+this.value), 1)
    rescale()
    svg.select('.' + this.id)
      .transition()
      .attr('d', emptyLine)
      .remove()
  }
  drawLegend()
}

function drawLine () {
  rescale()
  for (var i = 0; i < selected.length; i++) {
    var aggr = d3.nest()
    .key(function (d) { return +Math.round(+d.timeStamp / groupby) * groupby })
    .rollup(function (v) { return d3.mean(v, function (d) { return d.elapsed }) })
    .entries(n[selected[i]].values)
    svg.append('path')
    .datum(aggr)
    .attr('class', 'line ' + color.domain()[selected[i]])
    .style('stroke', color(color.domain()[selected[i]]))
    .attr('d', emptyLine)
    .transition()
    .attr('d', line0)
  }
  drawLegend()
}

function rescale () {
  var y0Max = d3.max(n, function (d, i) {
    if (selected.indexOf(i) !== -1) {
      return d.max
    }
  }) || 0
  if (y0Max !== y0.domain()[1]) {
    y0.domain([0, y0Max])
    svg.select('.y0')
      .transition()
      .call(y0Axis)
    svg.selectAll('.line').transition()
      .attr('d', line0)
  }
}

function drawLegend () {
  legend.selectAll('*').remove()

  legend.selectAll('input')
    .data(selected)
    .enter()
    .append('foreignObject')
      .attr('x', 45)
      .attr('y', function (d, i) {
        return i * 30
      })
      .attr('width', 20)
      .attr('height', 20)
    .append('xhtml:input')
      .attr('type', 'color')
      .attr('value', function (d) {
        return color(color.domain()[d])
      })
      .attr('id', function (d) {
        return color.domain()[d]
      })
      .style('width', '20px')
      .style('height', '20px')
      .style('background', 'none')
      .style('border', 'none')
      .style('padding', 0)
      .on('change', function () {
        var newColor = d3.select(this).property('value')
        svg.select('.' + this.id)
          .style('stroke', newColor)
      })

  legend.selectAll('text')
    .data(selected)
    .enter()
    .append('text')
    .attr('x', 70)
    .attr('y', function (d, i) {
      return i * 30 + 18
    })
    .text(function (d) {
      return color.domain()[d]
    })
}

init(width, height)

d3.select('#csv')
  .on('change', function () {
    var file = d3.event.target.files[0]
    if (file && ['text/plain', 'application/vnd.ms-excel', 'text/x-csv', 'text/csv'].includes(file.type)) {
      d3.select('label').text(file.name)
      var reader = new FileReader()
      reader.onloadend = function (evt) {
        dataUrl = evt.target.result
        d3.select('.check').selectAll('*').remove()
        svg.selectAll('*').remove()
        selected.length = 0
        readData(dataUrl)
      }
      reader.readAsDataURL(file)
    } else {
      d3.select('label').text('Invalid File!')
    }
  })

d3.select('#apply')
  .on('click', function () {
    if (!dataUrl) return
    var newWidth = (+d3.select('#width').property('value') || 1000) - margin.left - margin.right
    var newHeight = (+d3.select('#height').property('value') || 500) - margin.top - margin.bottom
    var newGroupby = +d3.select('#groupby').property('value') || 1000
    if (width !== newWidth || height !== newHeight) {
      width = newWidth
      height = newHeight
      init(width, height)
      drawSvg()
    }
    if (newGroupby !== groupby) {
      groupby = newGroupby
      svg.selectAll('.line').remove()
      drawLine()
    }
  })

function readData (csvUrl) {
  d3.csv(csvUrl, function (error, data) {
    var i = 0
    var m = {}
    n.length = 0
    if (error) throw error
    rawData = data
    data.forEach(function (d) {
      d.timeStamp = new Date(+d.timeStamp + +d.elapsed)
      d.elapsed = +d.elapsed
      d.allThreads = +d.allThreads
      if (m[d.label] === undefined) {
        m[d.label] = i
        n.push({
          name: d.label,
          max: 0,
          values: []
        })
        i++
      }
      n[m[d.label]].values.push(d)
      if (d.elapsed > n[m[d.label]].max) {
        n[m[d.label]].max = d.elapsed
      }
    })
    drawSvg()
  })
}
function drawSvg () {
  color.domain(n.map(function (d) {
    return d.name
  }))
    // add legend column
  legend = svg.append('g')
      .attr('class', 'legend')
      .attr('transform', 'translate(' + width + ',0)')

  x.domain(d3.extent(rawData, function (d) {
    return d.timeStamp
  }))
  y0.domain([0, 0])
  y1.domain([0, d3.max(rawData, function (d) {
    return d.allThreads
  })])
  // add axis
  svg.append('g')
      .attr('class', 'x axis')
      .attr('transform', 'translate(0,' + height + ')')
      .call(xAxis)

  svg.append('g')
      .attr('class', 'y0 axis')
      .call(y0Axis)
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 6)
      .attr('dy', '.71em')
      .style('text-anchor', 'end')
      .text('Response Times(ms)')

  svg.append('g')
      .attr('class', 'y1 axis')
      .attr('transform', 'translate(' + width + ' ,0)')
      .call(y1Axis)
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -14)
      .attr('dy', '0.71em')
      .style('text-anchor', 'end')
      .text('Users')
  // add area chart
  svg.append('path')
      .datum(rawData)
      .attr('class', 'area')
      .attr('d', area0)
  addCheckbox()
  drawLine()
}

function addCheckbox () {
  var checkboxes = d3.select('.check')
    .selectAll('div')
    .data(color.domain())
    .enter().append('div')
    .attr('class', 'form-check form-check-inline')
  checkboxes.append('input')
    .attr('type', 'checkbox')
    .attr('id', function (d) {
      return d
    })
    .attr('value', function (d, i) {
      return i
    })
    .attr('class', 'form-check-input')
    .on('change', change)
  checkboxes.append('label')
    .text(function (d) {
      return d
    })
    .attr('for', function (d) {
      return d
    })
    .attr('class', 'form-check-label')
}
