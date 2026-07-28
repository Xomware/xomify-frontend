import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { FavoritesRankedListComponent } from './favorites-ranked-list.component';
import { FavoriteItem, FavoritesService } from 'src/app/services/favorites.service';
import { ToastService } from 'src/app/services/toast.service';

describe('FavoritesRankedListComponent', () => {
  let component: FavoritesRankedListComponent;
  let fixture: ComponentFixture<FavoritesRankedListComponent>;
  let favoritesService: jasmine.SpyObj<FavoritesService>;
  let toastService: jasmine.SpyObj<ToastService>;

  function mkItem(rank: number, id = `sp${rank}`): FavoriteItem {
    return { rank, spotifyId: id, name: `Track ${id}`, artist: 'Artist', imageUrl: 'https://art/' + id };
  }

  beforeEach(() => {
    favoritesService = jasmine.createSpyObj('FavoritesService', [
      'updateListItems',
      'deleteList',
      'getListHistory',
      'getRecommendations',
    ]);
    (favoritesService as any).maxRank = 5;
    favoritesService.getListHistory.and.returnValue(of([]));

    toastService = jasmine.createSpyObj('ToastService', [
      'showPositiveToast',
      'showNegativeToast',
    ]);

    TestBed.configureTestingModule({
      declarations: [FavoritesRankedListComponent],
      providers: [
        { provide: FavoritesService, useValue: favoritesService },
        { provide: ToastService, useValue: toastService },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });

    fixture = TestBed.createComponent(FavoritesRankedListComponent);
    component = fixture.componentInstance;
    component.year = 2026;
    component.listId = 'l1';
    component.category = 'songs';
    component.title = 'Songs';
    component.items = [mkItem(1, 'a'), mkItem(2, 'b'), mkItem(3, 'c')];
  });

  function init() {
    fixture.detectChanges();
  }

  it('seeds localItems from the items input and loads history on init', () => {
    init();
    expect(component.localItems.length).toBe(3);
    expect(favoritesService.getListHistory).toHaveBeenCalledWith('l1');
  });

  it('isFull is true once localItems reaches maxRank', () => {
    init();
    component.localItems = [mkItem(1), mkItem(2), mkItem(3), mkItem(4), mkItem(5)];
    expect(component.isFull).toBeTrue();
  });

  it('moveUp swaps with the previous item and persists renumbered ranks', () => {
    favoritesService.updateListItems.and.returnValue(
      of({ listId: 'l1', category: 'songs', genreLabel: '', items: [] }),
    );
    init();

    component.moveUp(1); // move "b" above "a"

    expect(component.localItems.map((i) => i.spotifyId)).toEqual(['b', 'a', 'c']);
    expect(component.localItems.map((i) => i.rank)).toEqual([1, 2, 3]);
    expect(favoritesService.updateListItems).toHaveBeenCalledWith(
      2026,
      'l1',
      jasmine.arrayContaining([jasmine.objectContaining({ spotifyId: 'b', rank: 1 })]),
    );
  });

  it('moveUp at index 0 is a no-op', () => {
    init();
    component.moveUp(0);
    expect(favoritesService.updateListItems).not.toHaveBeenCalled();
  });

  it('removeItem rolls back and toasts on error', () => {
    favoritesService.updateListItems.and.returnValue(throwError(() => ({ status: 500 })));
    init();
    const before = [...component.localItems];

    component.removeItem(before[0]);

    expect(component.localItems).toEqual(before);
    expect(toastService.showNegativeToast).toHaveBeenCalled();
  });

  it('addItem is a no-op once the list is full', () => {
    init();
    component.localItems = [mkItem(1), mkItem(2), mkItem(3), mkItem(4), mkItem(5)];
    component.addItem(mkItem(0, 'new'));
    expect(favoritesService.updateListItems).not.toHaveBeenCalled();
  });

  it('confirmDelete asks for confirmation and emits listDeleted on success', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    favoritesService.deleteList.and.returnValue(of(undefined));
    component.deletable = true;
    init();

    let emitted: string | undefined;
    component.listDeleted.subscribe((id) => (emitted = id));
    component.confirmDelete();

    expect(favoritesService.deleteList).toHaveBeenCalledWith(2026, 'l1');
    expect(emitted).toBe('l1');
  });

  it('confirmDelete does nothing if the user cancels the confirm dialog', () => {
    spyOn(window, 'confirm').and.returnValue(false);
    component.deletable = true;
    init();

    component.confirmDelete();

    expect(favoritesService.deleteList).not.toHaveBeenCalled();
  });

  it('movementFor returns null before history has loaded', () => {
    // Don't call init() — ngOnInit (which fetches + flips historyLoaded) never runs.
    expect(component.movementFor(mkItem(1, 'a'))).toBeNull();
  });

  it('movementFor reports "new" for an item with a single history event', () => {
    favoritesService.getListHistory.and.returnValue(
      of([{ ts: '2026-03-01T00:00:00Z', spotifyId: 'a', fromRank: null, toRank: 1 }]),
    );
    init();
    expect(component.movementFor(mkItem(1, 'a'))).toEqual({ direction: 'new', delta: 0 });
  });

  it('movementFor reports "up" when the latest rank improved (lower number)', () => {
    favoritesService.getListHistory.and.returnValue(
      of([
        { ts: '2026-01-01T00:00:00Z', spotifyId: 'a', fromRank: null, toRank: 3 },
        { ts: '2026-03-01T00:00:00Z', spotifyId: 'a', fromRank: 3, toRank: 1 },
      ]),
    );
    init();
    expect(component.movementFor(mkItem(1, 'a'))).toEqual({ direction: 'up', delta: 2 });
  });

  it('movementFor reports "down" when the latest rank got worse (higher number)', () => {
    favoritesService.getListHistory.and.returnValue(
      of([
        { ts: '2026-01-01T00:00:00Z', spotifyId: 'a', fromRank: null, toRank: 1 },
        { ts: '2026-03-01T00:00:00Z', spotifyId: 'a', fromRank: 1, toRank: 4 },
      ]),
    );
    init();
    expect(component.movementFor(mkItem(4, 'a'))).toEqual({ direction: 'down', delta: 3 });
  });

  it('toggleSuggestions lazily fetches recommendations exactly once, defaulting to short_term', () => {
    favoritesService.getRecommendations.and.returnValue(
      of([{ spotifyId: 'x', name: 'X', artist: 'Y' }]),
    );
    init();

    component.toggleSuggestions();
    expect(component.suggestionsOpen).toBeTrue();
    expect(favoritesService.getRecommendations).toHaveBeenCalledWith(
      2026,
      'songs',
      'l1',
      'short_term',
    );
    expect(component.suggestions.length).toBe(1);

    component.toggleSuggestions(); // close
    component.toggleSuggestions(); // reopen — should NOT re-fetch, already cached
    expect(favoritesService.getRecommendations).toHaveBeenCalledTimes(1);
  });

  it('selectSuggestionsRange refetches with the new range while the strip is open', () => {
    favoritesService.getRecommendations.and.returnValue(
      of([{ spotifyId: 'x', name: 'X', artist: 'Y' }]),
    );
    init();

    component.toggleSuggestions();
    expect(favoritesService.getRecommendations).toHaveBeenCalledTimes(1);

    component.selectSuggestionsRange('long_term');
    expect(component.suggestionsRange).toBe('long_term');
    expect(favoritesService.getRecommendations).toHaveBeenCalledTimes(2);
    expect(favoritesService.getRecommendations).toHaveBeenCalledWith(
      2026,
      'songs',
      'l1',
      'long_term',
    );
  });

  it('selectSuggestionsRange clears the cache but does NOT refetch while the strip is closed', () => {
    favoritesService.getRecommendations.and.returnValue(
      of([{ spotifyId: 'x', name: 'X', artist: 'Y' }]),
    );
    init();

    component.selectSuggestionsRange('medium_term');
    expect(component.suggestionsRange).toBe('medium_term');
    expect(favoritesService.getRecommendations).not.toHaveBeenCalled();
  });
});
