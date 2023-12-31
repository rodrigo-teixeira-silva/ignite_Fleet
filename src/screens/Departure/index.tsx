import { useEffect, useRef, useState } from 'react';
import { TextInput, ScrollView, Alert} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'
import { Car } from 'phosphor-react-native';
import { useNavigation } from '@react-navigation/native';
import { 
  useForegroundPermissions, 
  requestBackgroundPermissionsAsync,
  watchPositionAsync, 
  LocationAccuracy,
  LocationSubscription,
  LocationObjectCoords
} from 'expo-location';

import {useUser} from '@realm/react'
import { useRealm } from '../../libs/realm';
import {Historic} from '../../libs/realm/schemas/Historic'

import { LicenseplateInput } from '../../components/LicenseplateInput';
import { TextAreaInput } from '../../components/TextAreaInput';
import { LocationInfo } from '../../components/locationInfo'
import { Loading } from '../../components/Loading';
import { Button } from '../../components/Button';
import { Header } from '../../components/Header';
import { Map } from '../../components/Map'

import { Container, Content, Message } from './styles';
import { licencePlateValidate } from '../../utils/LicencePlateValidate';
import { getAddressLocation } from '../../utils/getAddressLocation';
import { startLocationTask } from '../../tasks/backgroundLocationTask';


export function Departure() {
  const [ description, setDescription ] = useState('');
  const [ licensePlate, setLicensePlate ] = useState('');
  const [ isRegistering, setIsRegistering ] = useState(false);
  const [ isLoadingLocation, setIsLoadingLocation ] = useState(false);
  const [ currentAddress, setCurrentAddress ] = useState<string | null>(null);
  const [ currentCoords, setCurrentCoords] =useState<LocationObjectCoords |null>(null);

  const [ locationForegroundPermission, requestLocationForegroundPermission ] = useForegroundPermissions();

  const { goBack } = useNavigation();
  const realm = useRealm();
  const user = useUser();
  
  const descriptionRef = useRef<TextInput>(null);
  const licensePlateRef = useRef<TextInput>(null);
 
  async function handleDepartureRegister(){
  try{ 
    if(!licencePlateValidate(licensePlate)) {
      licensePlateRef.current?.focus();
        return Alert.alert('placa inválida' , 'A placa e inválida. Por favor informe a placa corrects do veículo')
    }

    if(description.trim().length === 0) {
      descriptionRef.current?.focus();
        return Alert.alert('Finalidade' , 'Por favor, informe a finalidade da utulização do veículo');
    }

    if(!currentCoords?.altitude && !currentCoords?.longitude){
      return Alert.alert('Localização',' não foi possível obter a localização ArrowsOutCardinal. Tente novamente!');
    }

    setIsRegistering(true);

    const backgroundPermissions = await requestBackgroundPermissionsAsync()
    if(!backgroundPermissions.granted) {
      setIsRegistering(false);
      return Alert.alert('Localização', 'É necessário permitir que o App tenha acesso localização em segundo plano. Acesse as configurações do dispositivo e habilite "Permitir o tempo todo."')
    }
    
    await startLocationTask();

    realm.write(() => {
      realm.create('Historic', Historic.generate({
        user_id: user!.id,
        license_plate: licensePlate.toUpperCase(),
        description,
        coords: [{
          latitude: currentCoords.latitude,
          longitude: currentCoords.longitude,
          timestamp: new Date().getTime()
        }]
      }));
    });

    Alert.alert('Saída','Saída do veículo registrada com sucesso')
    goBack();

  } catch(error){
    console.log(error)
    Alert.alert('Error','Não foi possível registrar a saída do veículo')
    setIsRegistering(false);
  }
}

useEffect(()=>{
  requestLocationForegroundPermission();
},[]);

useEffect(()=>{
  if(!locationForegroundPermission?.granted){
    return;
  }

  let subscription: LocationSubscription;

  watchPositionAsync({
    accuracy: LocationAccuracy.High,
    timeInterval: 1000
  }, (location) => {

    setCurrentCoords(location.coords);

    getAddressLocation(location.coords)
    .then((address) => {

      if(address) {
        setCurrentAddress(address)
      }
    }) 
    .finally(()=> setIsLoadingLocation(false))
  })
    .then((response) => subscription = response);

  return() =>{
    if(subscription){
    subscription.remove();
    }
  };

}, [locationForegroundPermission]);

if(!locationForegroundPermission?.granted) {
  return(
    <Container>
      <Header title="Saída"/>
      <Message>
        Você precisa permitir que o aplicativo tenha acesso a localização para utilizar essa funcionalidade.
        Por favor, acesse as configurações  do seu dispositivo para conceder essa permissão ao aplicativo.
      </Message>
    </Container>
  )
}

if(isLoadingLocation){
  return (
    <Loading />
  )
}
return (
  <Container>
    <Header title="Saída"/>

    <KeyboardAwareScrollView extraHeight={100}>
      <ScrollView>
      { currentCoords && <Map coordinates={[currentCoords]} />}


        <Content>
          {
            currentAddress && 
            <LocationInfo 
            icon={Car}
            label='Localização atual' 
            description={currentAddress}
            />    
          }

          <LicenseplateInput
              ref={licensePlateRef}
              label="Placa do veículo"
              placeholder='BRA1234'
              onSubmitEditing={()=>descriptionRef.current?.focus()}
              returnKeyType='next'
              onChangeText={setLicensePlate}
              />
            
          <TextAreaInput 
            ref={descriptionRef}
            label='Finalidade'
            placeholder= 'Vou utilizar o veículo para...'
            onSubmitEditing={handleDepartureRegister}
            returnKeyType='send'
            blurOnSubmit
            onChangeText={setDescription}
          /> 

          <Button
            title='Registrar saída'
            onPress={handleDepartureRegister}
            isLoading={isRegistering}
          />
        </Content>
      </ScrollView>
      </KeyboardAwareScrollView>
    </Container>
  );
}