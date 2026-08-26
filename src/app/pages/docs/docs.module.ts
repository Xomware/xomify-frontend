import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { DocsComponent } from './docs.component';

/**
 * Public — no `AuthGuard`. The whole point of this page is that someone who
 * has not signed in can read what the app does before handing over their
 * Spotify account.
 */
@NgModule({
  declarations: [DocsComponent],
  imports: [
    CommonModule,
    RouterModule.forChild([{ path: '', component: DocsComponent }]),
  ],
})
export class DocsModule {}
