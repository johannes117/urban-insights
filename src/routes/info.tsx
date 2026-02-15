import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/info')({
  component: InfoPage,
})

const sections = [
  { id: 'overview', title: 'Overview' },
  { id: 'features', title: 'Key Features' },
  { id: 'plainlang', title: 'Natural Language' },
  { id: 'dataqual', title: 'Authoritative Datasets' },
  { id: 'visualisation', title: 'Dynamic Visualisations' },
  { id: 'reporting', title: 'Report Generation' },
]

function InfoPage() {
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
          <h1 className="mb-3 text-4xl font-bold text-gray-900">Information and Support</h1>
          <p className="mb-12 text-lg text-gray-500">
            A short introduction to using Urban Insights effectively.
          </p>

          <section id="overview" className="mb-12 scroll-mt-24">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">Overview</h2>
            <p className="mb-4 leading-relaxed text-gray-600">
              Urban Insights brings together authoritative datasets from government agencies to provide
              comprehensive insights into Victorian communities. All data is organised by local government
              area (LGA) for easy comparison and analysis – see&nbsp;
              <Link to="/data-sources" className="text-cyan-700 underline hover:text-cyan-900">Data Sources</Link>
              &nbsp;for details.
            </p>
            <p className="leading-relaxed text-gray-600">
              Simply ask questions in natural language and Urban Insights will automatically query the
              relevant data to generate summaries and visualisations. This video demonstrates
              the basics, but the rest is really up to you. Ask any question you like, and Urban
              Insights will do its best to answer it using the data available.
            </p>

            <div className="mt-8">
            <iframe
              width="100%"
              height="350"
              src="https://www.youtube.com/embed/-he4ns3PPJE?rel=0"
              title="Urban Insights Demo"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="rounded-lg shadow-md"
            />
            </div>
          </section>

          <section id="features" className="mb-6 scroll-mt-24">
            <h2 className="mb-4 text-2xl flex items-center gap-2 font-semibold text-gray-900">
              Key features
            </h2>
            <p className="mb-3 leading-relaxed text-gray-600">
              So, what makes Urban Insights different from other tools?
            </p>
          </section>

          <section id="plainlang" className="mb-6 scroll-mt-24">
            <h3 className="mb-3 text-lg font-semibold text-gray-700">Natural Language</h3>
            <p className="mb-3 leading-relaxed text-gray-600">
              First, Urban Insights uses a natural, conversational language interface, allowing you to pose
              the questions you need answered. Urban Insights will draw out requested details, and explain
              other interesting trends in the data. Follow-up questions allow digging deeper or clarifying these results.
            </p>
            <p className="mb-3 leading-relaxed text-gray-600">
              This conversational approach offers a more intuitive approach than directly browsing the technically-oriented,
              raw data portals often provided by government agencies.
            </p>
            <p className="mb-3 leading-relaxed text-gray-600">
              In addition, recent conversations are retained in the session history (left panel), allowing you return to previous investigations
              and build on them. Visualisations within these conversations may be reviewed using the forward and back buttons at
              the top right of the page.
            </p>
          </section>

          <section id="dataqual" className="mb-6 scroll-mt-24">
            <h3 className="mb-3 text-lg font-semibold text-gray-700">Curated, Authoritative Datasets</h3>
            <p className="mb-3 leading-relaxed text-gray-600">
              Of course, many generic tools can query data in natural language. However, Urban Insights
              has been specifically designed to access only curated, authoritative datasets from
              government agencies. This ensures that the insights you receive are based on high-quality
              data that you can trust (see <Link to="/data-sources" className="text-cyan-700 underline hover:text-cyan-900">Data Sources</Link>).
            </p>
            <p className="mb-3 leading-relaxed text-gray-600">
              You may notice that Urban Insights will refuse to answer questions that fall outside of the scope
              of the data available. For example, asking about regions outside of Victoria will not yield useful results.
              This should provide confidence that the insights you receive are based on real data, not just
              plausible-sounding numbers.
            </p>
            <p className="mb-3 leading-relaxed text-gray-600">
              Future deployments of the tooling can be configured with alternative datasets to serve other
              regions, or even address subject matter beyond livability standards.
            </p>
          </section>

          <section id="visualisation" className="mb-6 scroll-mt-24">
            <h3 className="mb-3 text-lg font-semibold text-gray-700">Dynamic Visualisations</h3>
            <p className="mb-3 leading-relaxed text-gray-600">
              Urban Insights generates appropriate visualisations for the questions you pose.
              Textual insights are supported with charts (bar, line, pie, etc.) and tables.
            </p>
          </section>

          <section id="reporting" className="mb-6 scroll-mt-24">
            <h3 className="mb-3 text-lg font-semibold text-gray-700">Report Generation</h3>
            <p className="mb-3 leading-relaxed text-gray-600">
              On request, Urban Insights can even compile your query results into formatted reports for sharing with
              colleagues, neighbours, government representatives, or anyone else who might be interested. Just tell
              Urban Insights you would like to generate a report, and answer a few follow-up questions about
              intended audience and content. The generated report can then be downloaded as a PDF document.
            </p>
            <p className="mb-3 leading-relaxed text-gray-600">
              In addition, Urban Insights' commitment to data quality (see above) means that readers
              can trust that the data and insights contained in the report are based on real, authoritative sources.
            </p>
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
