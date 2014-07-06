h2d3.js
=======

Bar chart library based on [d3.js](http://d3js.org/)

## Features

- Horizontal and vertical bar charts
- Multiple series
- Long labels (auto-adjusting margin)
- Stacked mode
- Percent stacked mode
- Hide/Show series

## Examples

<a href='http://mcaule.github.io/h2d3.js/example.html' ><img src='http://mcaule.github.io/h2d3.js/img/example2.png'/></a>

[Example page](http://mcaule.github.io/h2d3.js/example.html)

## Installation

- Include `d3.js`
- Include `h2d3.min.js`
- Add a link to `h2d3.min.css`

## Usage

Create a chart function

```javascript
var chart = h2d3.chart()
          .width(800).height(400)
          .vertical()//horizontal by default       
          .percentMode(false)//disable percent mode
```

Assign a element and some data to the chart

```javascript
chart('#myDiv',data)
```

## Data format

h2d3.js read its data as a list of series

```javascript
[
  {
    key: "Serie1",
    values: [
      {label:"Group A","value":87},
      {label:"Group B","value":9}
    ]},
  {
    key: "Serie2",
    values: [
      {label:"Group A","value":30},
      {label:"Group B","value":75}
    ]}]
```

## Todolist

- Tooltips
- Sort bars

