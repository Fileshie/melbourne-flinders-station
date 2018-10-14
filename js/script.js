(function (window, $) {
    let map;
    let infowindow;
    let places = [];
    let templateContent = {};
    let markerContent;
    let placeTypesToSearch = ['movie_theater', 'restaurant', 'shopping_mall', 'bar', 'cafe'];
    let counter = 0;

    function renderPlaceDetailsTemplate(placeDetails) {
        let template =
            `<div class="marker-wrapper">
                <div class="place-title">
                    ${placeDetails.title} | Average rating ${placeDetails.rating} <i class="fa fa-star"></i>
                </div>
                <div class="place-hero">
                    <img src='${placeDetails.hero_image}' />
                </div>
                <hr />
                ${placeDetails.info}
            </div>`;
        return template;
    }

    // Use Google Places Service API
    let setPlaceDetailsContent = function (place) {
        var request = {
            placeId: place.place_id,
            fields: ['reviews', 'formatted_address', 'formatted_phone_number', 'website']
        };

        let placesService = new google.maps.places.PlacesService(map);
        placesService.getDetails(request, function (placeDetails, status) {
            if (status == google.maps.places.PlacesServiceStatus.OK) {
                templateContent.info = 
                    `<div class="place-info">
                        <div class="place-info-item">Address: ${placeDetails.formatted_address ? placeDetails.formatted_address : 'n/a' } </div>
                        <div class="place-info-item">Web: <a target='_blank' href='${placeDetails.website ? placeDetails.website : '#'}'> ${placeDetails.website ? placeDetails.website : 'n/a' } </a> </div>
                        <div class="place-info-item">Phone: ${placeDetails.formatted_phone_number ? placeDetails.formatted_phone_number : 'n/a' } </div>
                        <div class="place-info-item">Latest review: ${placeDetails.reviews[0].rating ? placeDetails.reviews[0].rating : ''} <i class="fa fa-star"></i> </div>
                        <div class="place-info-item review">${placeDetails.reviews[0].text ? placeDetails.reviews[0].text : 'n/a' } </div>
                     </div>`;

            } else {
                templateContent.info = "Could not get place details";
            }

            markerContent = renderPlaceDetailsTemplate(templateContent);
            infowindow.setContent(markerContent);
        });
    };

    /*
     * Sort places alphabetically and create marker
     * 
    */
    function sortAndCreateMarker() {
        let sortedPlaces = 
            places.sort(function (a, b) {
                let nameA = a.name.toLowerCase(), nameB = b.name.toLowerCase();
                if (nameA < nameB)
                    return -1;
                if (nameA > nameB)
                    return 1;
                return 0;
            });

        for (let i = 0; i < sortedPlaces.length; i++) {
            let place = sortedPlaces[i];
            createMarker(place, i);
        }
    }

    /*
     * Create Markers for each location
     * Followed code logic from Google Places  : https://developers.google.com/maps/documentation/javascript/examples/place-search
    */
    function handlePlacesCallback(results, status, placeSearchPagination) {
        if (status === google.maps.places.PlacesServiceStatus.OK) {
            for (let i = 0; i < results.length; i++) {
                let placeExists = places.find(item => item.name === results[i].name);
                if (!placeExists) {
                    places.push(results[i]);
                }
            }

            if (placeSearchPagination.hasNextPage) {
                placeSearchPagination.nextPage();
            } else {
                counter++;
                if (counter === placeTypesToSearch.length) {
                    sortAndCreateMarker();
                    counter = 0;
                }                
            }
        }
    }

    // Google Maps Marker animation : https://developers.google.com/maps/documentation/javascript/examples/marker-animations
    function toggleBounce(marker) {
        if (marker.getAnimation() !== null) {
            marker.setAnimation(null);
        } else {
            marker.setAnimation(google.maps.Animation.BOUNCE);
            setTimeout(function () {
                marker.setAnimation(null);
            }, 700);
        }
    }

    function createMarker(place, i) {
        let placePhoto = place.photos ? place.photos[0].getUrl({ 'minWidth': 400, 'maxHeight': 200 }) : null;
        if (!placePhoto) {
            return;
        }

        let marker = new google.maps.Marker({
            map: map,
            position: place.geometry.location,
            title: place.name,
            animation: google.maps.Animation.DROP,
            details: { icon: place.icon, rating: place.rating, hero_image: placePhoto, vicinity: place.vicinity },
            id: i
        });

        /*
         * Onclick event that adds an info window when each marker is clicked
        */
        marker.addListener("click", function () {
            let placeDetailsContent = "Looking up info... <i class='fa fa-search'></i>"
            templateContent = {
                title: marker.title,
                rating: marker.details.rating,
                hero_image: marker.details.hero_image,
                info: placeDetailsContent
            };
            markerContent = renderPlaceDetailsTemplate(templateContent);

            setPlaceDetailsContent(place);
            infowindow.setContent(markerContent);
            infowindow.open(map, marker);
            toggleBounce(marker);
        });

        vm.addToMarkersArray(marker);
    }

    /*
      * Initialize Javascript function to load the map
      * Contains everything that will happen after the page loads but before the user interacts with the map
    */
    function initMap() {
        let flindersStation = { lat: -37.8182711, lng: 144.9670618 };

        map = new google.maps.Map(document.getElementById("map"), {
            center: flindersStation,
            zoom: 17
        });

        infowindow = new google.maps.InfoWindow();
        let service = new google.maps.places.PlacesService(map);

        /*
          ** These are the points of interest that will be shown to the user
          ** Used the Google Places api
        */
        placeTypesToSearch.forEach(function (type, index) {
            service.nearbySearch(
                {
                    location: flindersStation,
                    radius: 250,
                    type: type
                },
                handlePlacesCallback
            );
        });
    }

    // Viewmodel
    function MapViewModel() {
        let self = this;
        self.markersArray = ko.observableArray();
        self.filteredMarkersArray = ko.observableArray();
        //input box for search term
        self.searchTerm = ko.observable("");

        self.isListPlacesLoaded = ko.pureComputed(() => {
            return self.markersArray().length > 0;
        });

        self.addToMarkersArray = marker => {
            self.markersArray.push(marker);
            self.filteredMarkersArray.push(marker);
        };

        self.markerSelected = marker => {
            google.maps.event.trigger(marker, "click");
        };

        self.onEnterSearch = (d, e) => {
            if (e.keyCode === 13) {
                self.search();
            }
            return true;
        };

        self.search = () => {
            resetMap();
            self.filteredMarkersArray.removeAll();

            self.markersArray().forEach(item => {
                if (item.title.toUpperCase().includes(self.searchTerm().toUpperCase())) {
                    self.filteredMarkersArray.push(item);
                } else {
                    item.setMap(null);
                }
            });
        };

        self.reset = () => {
            self.filteredMarkersArray.removeAll();
            resetMap();
            self.searchTerm("");
        };

        resetMap = () => {
            self.markersArray().forEach(item => {
                self.filteredMarkersArray.push(item);
                item.setMap(map);
            });
        };
    }

    // hide and show list for mobile view
    function handleGoogleMapError() {
        alert('Error loading Google Maps');
    }

    // code from : https://stackoverflow.com/questions/16844193/google-maps-does-not-display-on-bootstrap
    $(document).ready(function () {
        let height = $(document).height();
        $("#map").css("height", height);
    });

    $(document).resize(function () {
        let height = $(document).height();
        $("#map").css("height", height);
    });

    // Apply bindings and expose map handlers
    let vm = new MapViewModel();
    ko.applyBindings(vm, document.getElementById("google-places-melbourne-poi-app"));
    window.initMap = initMap;
    window.handleGoogleMapError = handleGoogleMapError;

})(window, jQuery);
//http://www.nicoespeon.com/en/2013/05/properly-isolate-variables-in-javascript/