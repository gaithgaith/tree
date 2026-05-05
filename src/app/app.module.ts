import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { OrganizationChartModule } from 'primeng/organizationchart';

import { AppComponent } from './app.component';
import { OrgDetailsPanelComponent } from './org-details-panel.component';
import { OrgNodeCardComponent } from './org-node-card.component';
import { OrgTreeComponent } from './org-tree.component';
import { OrgVerticalTreeComponent } from './org-vertical-tree.component';

@NgModule({
  declarations: [
    AppComponent,
    OrgTreeComponent,
    OrgNodeCardComponent,
    OrgDetailsPanelComponent,
    OrgVerticalTreeComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    OrganizationChartModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
