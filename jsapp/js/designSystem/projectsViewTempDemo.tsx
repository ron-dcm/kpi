import React from 'react';
import type {
  ProjectsFilterDefinition,
  ProjectFieldName,
} from 'js/components/projectsView/projectsViewConstants';
import ProjectsFilter from 'js/components/projectsView/projectsFilter';
import ProjectsFieldsSelector from 'js/components/projectsView/projectsFieldsSelector';

import ProjectsTable from 'js/components/projectsTable/projectsTable';
import type {OrderDirection} from 'js/components/projectsTable/projectsTableConstants';
import {ProjectsTableContextName} from 'js/components/projectsTable/projectsTableConstants';
import mockAssets from 'js/components/projectsView/assetsResponseMock';

interface ProjectsViewTempDemoState {
  filters: ProjectsFilterDefinition[];
  fields: ProjectFieldName[] | undefined;
}

export default class ProjectsViewTempDemo extends React.Component<{}, ProjectsViewTempDemoState> {
  constructor(props: {}) {
    super(props);
    this.state = {
      filters: [],
      fields: undefined,
    };
  }

  onFiltersChange(filters: ProjectsFilterDefinition[]) {
    console.log('onFiltersChange', filters);
    this.setState({filters: filters});
  }

  onFieldsChange(fields: ProjectFieldName[] | undefined) {
    console.log('onFieldsChange', fields);
    this.setState({fields: fields});
  }

  render() {
    return (
      <section>
        <h1>Projects View temporary demo</h1>

        <ProjectsFilter
          onFiltersChange={this.onFiltersChange.bind(this)}
          filters={this.state.filters}
        />


        <ProjectsFieldsSelector
          onFieldsChange={this.onFieldsChange.bind(this)}
          selectedFields={this.state.fields}
        />

        <hr/>

        <ProjectsTable
          context={ProjectsTableContextName.MY_LIBRARY}
          assets={mockAssets.results}
          totalAssets={mockAssets.count}
          metadata={mockAssets.metadata}
          orderColumnId='name'
          orderValue='ascending'
          onOrderChange={(columnId: string, columnValue: OrderDirection) => console.log(columnId, columnValue)}
          filterColumnId={null}
          filterValue={null}
          onFilterChange={(columnId: string | null, columnValue: string | null) => console.log(columnId, columnValue)}
        />

        <hr/>
      </section>
    );
  }
}
