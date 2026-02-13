import { createFileRoute, Link } from '@tanstack/react-router'
import { ExternalLink } from 'lucide-react'

export const Route = createFileRoute('/data-sources')({
  component: DataSourcesPage,
})

const sections = [
  { id: 'overview', title: 'Overview' },
  { id: 'census', title: '2021 Census Data' },
  { id: 'rental', title: 'Rental Affordability' },
  { id: 'house-prices', title: 'Median House Prices' },
  { id: 'housing-projections', title: 'Housing Projections' },
  { id: 'schools', title: 'Schools' },
  { id: 'disasters', title: 'Disaster Activations' },
  { id: 'crime', title: 'Crime Rates' },
  { id: 'gambling', title: 'Gambling' },
]

function DataSourcesPage() {
  return (
    <div className="h-screen overflow-y-auto bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="flex justify-center px-6 py-4">
          <div className="flex w-full max-w-xl items-center">
            <Link
              to="/"
              search={{ newchat: '1' }}
              className="flex items-center gap-3 pl-1"
            >
              <img
                src="/images/urban-insights-logo-crop.png"
                alt="Urban Insights"
                className="h-11 w-auto"
              />
              <span className="font-medium text-gray-900">Urban Insights</span>
            </Link>
          </div>
          <div className="ml-16 hidden w-48 shrink-0 items-center xl:flex">
            <Link
              to="/"
              search={{ newchat: undefined }}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900"
            >
              Back to App
            </Link>
          </div>
        </div>
      </header>

      <div className="flex justify-center px-6 py-12">
        <main className="w-full max-w-xl">
          <div className="mb-2 text-sm font-medium text-cyan-600">Reference</div>
          <h1 className="mb-4 text-4xl font-bold text-gray-900">Data Sources</h1>
          <p className="mb-12 text-lg text-gray-500">
            Details of the datasets available for Victorian local government areas.
          </p>

          <section id="overview" className="mb-12 scroll-mt-24">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">Overview</h2>
            <p className="mb-4 leading-relaxed text-gray-600">
              Urban Insights brings together authoritative datasets from government agencies to provide
              comprehensive insights into Victorian communities. There are many sources, so check the
              index on the right to help find what you are looking for.
            </p>
            <p className="mb-4 leading-relaxed text-gray-600">
              Simply ask questions in natural language and Urban Insights will automatically query the
              relevant data and generate visualisations – see <Link to="/info" className="text-cyan-700 underline hover:text-cyan-900">Support</Link> for details.
            </p>
            <p className="mb-4 leading-relaxed text-gray-600">
              All data is organised by local government
              area (LGA) for easy comparison and analysis. The data has also been cleaned and
              pre-processed for performance and consistency across the different datasets.
            </p>
          </section>

          <section id="census" className="mb-12 scroll-mt-24">
            <h2 className="mb-4 text-2xl flex items-center gap-2 font-semibold text-gray-900">
              2021 Census Data
              <span>
                <a href="https://www.abs.gov.au/statistics" target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={18} className="text-gray-400 hover:text-cyan-600 cursor-pointer" />
                </a>
              </span>
            </h2>
            <p className="mb-4 leading-relaxed text-gray-600">
              Comprehensive demographic and socioeconomic data from the 2021 Australian Census&nbsp;
                <a href="https://www.abs.gov.au/census/find-census-data/datapacks" target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={14} className="inline align-baseline text-gray-400 hover:text-cyan-600 cursor-pointer" />
                </a>
              , provided by the <span className="text-gray-900">Australian Bureau of Statistics</span>.
            </p>
            <p className="mb-3 text-gray-600">This dataset includes:</p>
            <ul className="mb-6 list-disc space-y-1.5 pl-5 text-gray-600">
              <li>Population information</li>
              <li>Economic factors</li>
              <li>Cultural diversity</li>
              <li>Education levels</li>
              <li>Socio-Economic Indexes for Areas (SEIFA&nbsp;
                <a href="https://www.abs.gov.au/statistics/people/people-and-communities/socio-economic-indexes-areas-seifa-australia/latest-release" target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={14} className="inline align-baseline text-gray-400 hover:text-cyan-600 cursor-pointer" />
                </a>
                ) including relative advantage, disadvantage, economic resources and educational opportunity</li>
            </ul>
            <div className="rounded-lg border border-gray-200 bg-white p-4 pb-3 pt-3 text-sm">
              <div className="flex gap-8">
                <div>
                  <span className="text-gray-400">Coverage</span>
                  <p className="text-gray-700">All Victorian LGAs</p>
                </div>
                <div>
                  <span className="text-gray-400">Published</span>
                  <p className="text-gray-700">2021</p>
                </div>
                <div>
                  <span className="text-gray-400">Data period</span>
                  <p className="text-gray-700">2021</p>
                </div>
                <div>
                  <span className="text-gray-400">License</span>
                  <p className="text-gray-700"><a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a></p>
                </div>
              </div>
              <div>
                <p className="mt-4 text-gray-600">ⓒ Copyright Commonwealth of Australia</p>
              </div>
            </div>
          </section>

          <section id="rental" className="mb-12 scroll-mt-24">
            <h2 className="mb-4 text-2xl flex items-center gap-2 font-semibold text-gray-900">
              Rental Affordability
              <span>
                <a href="https://www.dffh.vic.gov.au/affordable-lettings-local-government-area-june-quarter-2025-excel" target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={18} className="text-gray-400 hover:text-cyan-600 cursor-pointer" />
                </a>
              </span>
            </h2>
            <p className="mb-4 leading-relaxed text-gray-600">
              Historical data tracking the availability and affordability of rental properties across
              Victorian LGAs, provided by <span className="text-gray-900">Housing Victoria</span>.
            </p>
            <p className="mb-3 text-gray-600">This dataset includes:</p>
            <ul className="mb-6 list-disc space-y-1.5 pl-5 text-gray-600">
              <li>Number of affordable rental properties on the market</li>
              <li>Percentage of total rentals considered affordable</li>
              <li>Trends over time by LGA</li>
            </ul>
            <div className="rounded-lg border border-gray-200 bg-white p-4 pb-3 pt-3 text-sm">
              <div className="flex gap-8">
                <div>
                  <span className="text-gray-400">Coverage</span>
                  <p className="text-gray-700">All Victorian LGAs</p>
                </div>
                <div>
                  <span className="text-gray-400">Published</span>
                  <p className="text-gray-700">2025</p>
                </div>
                <div>
                  <span className="text-gray-400">Data period</span>
                  <p className="text-gray-700">2000–2025</p>
                </div>
                <div>
                  <span className="text-gray-400">License</span>
                  <p className="text-gray-700"><a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a></p>
                </div>
              </div>
              <div>
                <p className="mt-4 text-gray-600">ⓒ Copyright State Government of Victoria</p>
              </div>
            </div>
          </section>

          <section id="house-prices" className="mb-12 scroll-mt-24">
            <h2 className="mb-4 text-2xl flex items-center gap-2 font-semibold text-gray-900">
              Median House Prices
              <span>
                <a href="https://discover.data.vic.gov.au/dataset/victorian-property-sales-report-median-house-by-suburb" target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={18} className="text-gray-400 hover:text-cyan-600 cursor-pointer" />
                </a>
              </span>
            </h2>
            <p className="mb-4 leading-relaxed text-gray-600">
              Current median house price data for suburbs across Victoria,
              provided by <span className="text-gray-900">DataVic</span>.
            </p>
            <p className="mb-3 text-gray-600">This dataset includes:</p>
            <ul className="mb-6 list-disc space-y-1.5 pl-5 text-gray-600">
              <li>Median house prices by suburb</li>
              <li>Mapped to Local Government Areas</li>
            </ul>
            <div className="rounded-lg border border-gray-200 bg-white p-4 pb-3 pt-3 text-sm">
              <div className="flex gap-8">
                <div>
                  <span className="text-gray-400">Coverage</span>
                  <p className="text-gray-700">Victorian suburbs</p>
                </div>
                <div>
                  <span className="text-gray-400">Published</span>
                  <p className="text-gray-700">2025</p>
                </div>
                <div>
                  <span className="text-gray-400">Data period</span>
                  <p className="text-gray-700">2024–2025</p>
                </div>
                <div>
                  <span className="text-gray-400">License</span>
                  <p className="text-gray-700"><a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a></p>
                </div>
              </div>
              <div>
                <p className="mt-4 text-gray-600">ⓒ Copyright State Government of Victoria</p>
              </div>
            </div>
          </section>

          <section id="housing-projections" className="mb-12 scroll-mt-24">
            <h2 className="mb-4 text-2xl flex items-center gap-2 font-semibold text-gray-900">
              Housing Projections
              <span>
                <a href="https://discover.data.vic.gov.au/dataset/vif2023-lga-population-household-dwelling-projections-to-2036" target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={18} className="text-gray-400 hover:text-cyan-600 cursor-pointer" />
                </a>
              </span>
            </h2>
            <p className="mb-4 leading-relaxed text-gray-600">
              The Victoria in Future dataset projects population growth and dwelling occupancy
              over the period 2021–2036, provided by the <span className="text-gray-900">Department of Transport
              and Planning</span>.
            </p>
            <p className="mb-3 text-gray-600">
              Population and housing occupancy are estimated by region covering:
            </p>
            <ul className="mb-6 list-disc space-y-1.5 pl-5 text-gray-600">
              <li>size</li>
              <li>distribution</li>
              <li>composition</li>
            </ul>
            <p className="mb-3 text-gray-600">
              The projections give an idea of what is likely to happen if current
              trends continue. They are developed using mathematical
              models and expert knowledge, relying on trend analysis and assumptions.
            </p>
            <div className="rounded-lg border border-gray-200 bg-white p-4 pb-3 pt-3 text-sm">
              <div className="flex gap-8">
                <div>
                  <span className="text-gray-400">Coverage</span>
                  <p className="text-gray-700">All Victorian LGAs</p>
                </div>
                <div>
                  <span className="text-gray-400">Published</span>
                  <p className="text-gray-700">2023</p>
                </div>
                <div>
                  <span className="text-gray-400">Data period</span>
                  <p className="text-gray-700">2021–2036</p>
                </div>
                <div>
                  <span className="text-gray-400">License</span>
                  <p className="text-gray-700"><a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a></p>
                </div>
              </div>
              <div>
                <p className="mt-4 text-gray-600">ⓒ Copyright State Government of Victoria</p>
              </div>
            </div>
          </section>

          <section id="schools" className="mb-12 scroll-mt-24">
            <h2 className="mb-4 text-2xl flex items-center gap-2 font-semibold text-gray-900">
              Schools
              <span>
                <a href="https://discover.data.vic.gov.au/dataset/school-locations-2025" target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={18} className="text-gray-400 hover:text-cyan-600 cursor-pointer" />
                </a>
              </span>
            </h2>
            <p className="mb-4 leading-relaxed text-gray-600">
              Locations and details of registered schools across Victoria to support analysis of
              education access, provided by <span className="text-gray-900">DataVic</span>.
            </p>
            <p className="mb-3 text-gray-600">This dataset includes:</p>
            <ul className="mb-6 list-disc space-y-1.5 pl-5 text-gray-600">
              <li>School locations mapped to LGAs</li>
              <li>School types (primary, secondary, etc.)</li>
              <li>Supports analysis of education accessibility</li>
            </ul>
            <div className="rounded-lg border border-gray-200 bg-white p-4 pb-3 pt-3 text-sm">
              <div className="flex gap-8">
                <div>
                  <span className="text-gray-400">Coverage</span>
                  <p className="text-gray-700">All Victorian schools</p>
                </div>
                <div>
                  <span className="text-gray-400">Published</span>
                  <p className="text-gray-700">2024</p>
                </div>
                <div>
                  <span className="text-gray-400">Data period</span>
                  <p className="text-gray-700">2024</p>
                </div>
                <div>
                  <span className="text-gray-400">License</span>
                  <p className="text-gray-700"><a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a></p>
                </div>
              </div>
              <div>
                <p className="mt-4 text-gray-600">ⓒ Copyright State Government of Victoria</p>
              </div>
            </div>
          </section>

          <section id="disasters" className="mb-12 scroll-mt-24">
            <h2 className="mb-4 text-2xl flex items-center gap-2 font-semibold text-gray-900">
              National Disaster Activations
              <span>
                <a href="https://data.gov.au/data/dataset/drfa-activation-history-by-lga/resource/ada7908b-afe6-48f3-966b-789aa26c1391" target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={18} className="text-gray-400 hover:text-cyan-600 cursor-pointer" />
                </a>
              </span>
            </h2>
            <p className="mb-4 leading-relaxed text-gray-600">
              Event-level information on significant emergency incidents in Victoria,
              provided by the <span className="text-gray-900">National Emergency Management Agency</span>.
            </p>
            <p className="mb-3 text-gray-600">This dataset includes:</p>
            <ul className="mb-6 list-disc space-y-1.5 pl-5 text-gray-600">
              <li>Emergency incident records</li>
              <li>Disaster types and severity</li>
              <li>Historical trends by LGA</li>
            </ul>
            <div className="rounded-lg border border-gray-200 bg-white p-4 pb-3 pt-3 text-sm">
              <div className="flex gap-8">
                <div>
                  <span className="text-gray-400">Coverage</span>
                  <p className="text-gray-700">Victorian LGAs</p>
                </div>
                <div>
                  <span className="text-gray-400">Published</span>
                  <p className="text-gray-700">2025</p>
                </div>
                <div>
                  <span className="text-gray-400">Data period</span>
                  <p className="text-gray-700">2007–2025</p>
                </div>
                <div>
                  <span className="text-gray-400">License</span>
                  <p className="text-gray-700"><a href="https://creativecommons.org/licenses/by/2.5/" target="_blank" rel="noopener noreferrer">CC BY 2.5</a></p>
                </div>
              </div>
              <div>
                <p className="mt-4 text-gray-600">ⓒ Copyright Commonwealth of Australia</p>
              </div>
            </div>
          </section>

          <section id="crime" className="mb-12 scroll-mt-24">
            <h2 className="mb-4 text-2xl flex items-center gap-2 font-semibold text-gray-900">
              Crime Rates
              <span>
                <a href="https://www.crimestatistics.vic.gov.au/crime-statistics/latest-victorian-crime-data/download-data" target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={18} className="text-gray-400 hover:text-cyan-600 cursor-pointer" />
                </a>
              </span>
            </h2>
            <p className="mb-4 leading-relaxed text-gray-600">
              Recorded criminal offences across Victorian LGAs,
              provided by the <span className="text-gray-900">Crime Statistics Agency</span>.
            </p>
            <p className="mb-3 text-gray-600">This dataset includes:</p>
            <ul className="mb-6 list-disc space-y-1.5 pl-5 text-gray-600">
              <li>Criminal offence records by type</li>
              <li>Comparison of crime patterns across LGAs</li>
              <li>Volume and trend analysis</li>
            </ul>
            <div className="rounded-lg border border-gray-200 bg-white p-4 pb-3 pt-3 text-sm">
              <div className="flex gap-8">
                <div>
                  <span className="text-gray-400">Coverage</span>
                  <p className="text-gray-700">All Victorian LGAs</p>
                </div>
                <div>
                  <span className="text-gray-400">Published</span>
                  <p className="text-gray-700">2024</p>
                </div>
                <div>
                  <span className="text-gray-400">Data period</span>
                  <p className="text-gray-700">2024</p>
                </div>
                <div>
                  <span className="text-gray-400">License</span>
                  <p className="text-gray-700"><a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a></p>
                </div>
              </div>
              <div>
                <p className="mt-4 text-gray-600">ⓒ Copyright State Government of Victoria</p>
              </div>
            </div>
          </section>

          <section id="gambling" className="mb-12 scroll-mt-24">
            <h2 className="mb-4 text-2xl flex items-center gap-2 font-semibold text-gray-900">
              Gambling
              <span>
                <a href="https://www.vgccc.vic.gov.au/for-community/gambling-victoria/gambling-data" target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={18} className="text-gray-400 hover:text-cyan-600 cursor-pointer" />
                </a>
              </span>
            </h2>
            <p className="mb-4 leading-relaxed text-gray-600">
              Gambling statistics provided by the <span className="text-gray-900">Victorian Gambling and Casino Control
              Commission</span>.
            </p>
            <p className="mb-3 text-gray-600">This dataset includes:</p>
            <ul className="mb-6 list-disc space-y-1.5 pl-5 text-gray-600">
              <li>Number of venues</li>
              <li>Number of machines</li>
              <li>Losses on electronic gaming machines</li>
            </ul>
            <div className="rounded-lg border border-gray-200 bg-white p-4 pb-3 pt-3 text-sm">
              <div className="flex gap-8">
                <div>
                  <span className="text-gray-400">Coverage</span>
                  <p className="text-gray-700">All Victorian LGAs</p>
                </div>
                <div>
                  <span className="text-gray-400">Published</span>
                  <p className="text-gray-700">2025</p>
                </div>
                <div>
                  <span className="text-gray-400">Data period</span>
                  <p className="text-gray-700">2024–2025</p>
                </div>
                <div>
                  <span className="text-gray-400">License</span>
                  <p className="text-gray-700"><a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a></p>
                </div>
              </div>
              <div>
                <p className="mt-4 text-gray-600">ⓒ Copyright State Government of Victoria</p>
              </div>
            </div>
          </section>
        </main>

        <aside className="ml-16 hidden w-48 shrink-0 xl:block">
          <div className="sticky top-24">
            <div className="mb-3 flex items-center gap-2 text-sm text-gray-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
              </svg>
              On this page
            </div>
            <nav className="space-y-2 border-l border-gray-200 text-sm">
              {sections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="-ml-px block border-l border-transparent py-1 pl-4 text-gray-400 transition-colors hover:border-gray-400 hover:text-gray-600"
                >
                  {section.title}
                </a>
              ))}
            </nav>
          </div>
        </aside>
      </div>
    </div>
  )
}
