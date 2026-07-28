import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { of, throwError } from 'rxjs';

import { FavoritesComponent } from './favorites.component';
import { FavoritesList, FavoritesService } from 'src/app/services/favorites.service';
import { ToastService } from 'src/app/services/toast.service';

describe('FavoritesComponent', () => {
  let component: FavoritesComponent;
  let fixture: ComponentFixture<FavoritesComponent>;
  let favoritesService: jasmine.SpyObj<FavoritesService>;
  let toastService: jasmine.SpyObj<ToastService>;

  const emptyResponse = {
    year: new Date().getFullYear(),
    overall: { songs: [], albums: [], artists: [] },
    lists: [],
  };

  beforeEach(() => {
    favoritesService = jasmine.createSpyObj('FavoritesService', [
      'getFavorites',
      'createList',
      'deleteList',
      'overallListId',
    ]);
    favoritesService.getFavorites.and.returnValue(of(emptyResponse));
    favoritesService.overallListId.and.callFake(
      (year: number, category: string) => `overall:${year}:${category}`,
    );

    toastService = jasmine.createSpyObj('ToastService', [
      'showPositiveToast',
      'showNegativeToast',
    ]);

    TestBed.configureTestingModule({
      declarations: [FavoritesComponent],
      imports: [FormsModule],
      providers: [
        { provide: FavoritesService, useValue: favoritesService },
        { provide: ToastService, useValue: toastService },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });

    fixture = TestBed.createComponent(FavoritesComponent);
    component = fixture.componentInstance;
  });

  it('loads the current year on init and moves to the loaded state', () => {
    fixture.detectChanges();
    expect(favoritesService.getFavorites).toHaveBeenCalledWith(new Date().getFullYear());
    expect(component.state).toBe('loaded');
  });

  it('shows an error state when the fetch fails (not a 404)', () => {
    favoritesService.getFavorites.and.returnValue(throwError(() => ({ status: 500 })));
    fixture.detectChanges();
    expect(component.state).toBe('error');
  });

  it('retry() re-fetches for the current year', () => {
    fixture.detectChanges();
    favoritesService.getFavorites.calls.reset();
    component.retry();
    expect(favoritesService.getFavorites).toHaveBeenCalledTimes(1);
  });

  it('onYearChange() is a no-op for the currently-selected year', () => {
    fixture.detectChanges();
    favoritesService.getFavorites.calls.reset();

    component.onYearChange(component.year);

    expect(favoritesService.getFavorites).not.toHaveBeenCalled();
  });

  it('onYearChange() switches years and re-fetches for the new year', () => {
    fixture.detectChanges();
    favoritesService.getFavorites.calls.reset();
    const targetYear = component.year - 1;

    component.onYearChange(targetYear);

    expect(component.year).toBe(targetYear);
    expect(favoritesService.getFavorites).toHaveBeenCalledWith(targetYear);
  });

  it('offers the current year plus 5 retroactive years, most recent first', () => {
    fixture.detectChanges();
    const now = new Date().getFullYear();
    expect(component.years).toEqual([now, now - 1, now - 2, now - 3, now - 4, now - 5]);
  });

  it('createList() appends the new list and closes the modal on success', () => {
    fixture.detectChanges();
    const created: FavoritesList = { listId: 'l1', category: 'albums', genreLabel: 'Top EDM', items: [] };
    favoritesService.createList.and.returnValue(of(created));
    component.newListOpen = true;

    component.createList({ category: 'albums', genreLabel: 'Top EDM' });

    expect(component.lists).toContain(created);
    expect(component.newListOpen).toBeFalse();
    expect(component.creatingList).toBeFalse();
    expect(toastService.showPositiveToast).toHaveBeenCalled();
  });

  it('createList() surfaces an error toast and keeps the modal open on failure', () => {
    fixture.detectChanges();
    favoritesService.createList.and.returnValue(throwError(() => ({ status: 500 })));
    component.newListOpen = true;

    component.createList({ category: 'songs', genreLabel: 'Late Night Drives' });

    expect(component.lists.length).toBe(0);
    expect(component.newListOpen).toBeTrue();
    expect(toastService.showNegativeToast).toHaveBeenCalled();
  });

  it('onListDeleted() removes the list by id', () => {
    fixture.detectChanges();
    component.lists = [
      { listId: 'l1', category: 'songs', genreLabel: 'A', items: [] },
      { listId: 'l2', category: 'songs', genreLabel: 'B', items: [] },
    ];

    component.onListDeleted('l1');

    expect(component.lists.map((l) => l.listId)).toEqual(['l2']);
  });
});
