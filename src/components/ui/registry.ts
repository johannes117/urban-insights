import { Card } from './Card'
import { Metric } from './Metric'
import { Text } from './Text'
import { Grid } from './Grid'
import { Table } from './Table'
import { List } from './List'
import { BarChart } from './BarChart'
import { LineChart } from './LineChart'
import { PieChart } from './PieChart'
import { Container } from './Container'

export const componentRegistry = {
  Card,
  Metric,
  Text,
  Grid,
  Table,
  List,
  BarChart,
  LineChart,
  PieChart,
  div: Container,
  span: Container,
  section: Container,
}

export type ComponentRegistry = typeof componentRegistry
