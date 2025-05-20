/**
 * ジオコーディングサービス
 * 住所から緯度経度情報を取得するサービス
 */
import axios from 'axios';
import config from '../../config';
import logger from '../../common/utils/logger';

/**
 * ジオコーディング応答インターフェース
 */
interface GeocodingResponse {
  results: {
    formatted_address: string;
    geometry: {
      location: {
        lat: number;
        lng: number;
      }
    }
  }[];
  status: string;
}

/**
 * ジオコーディング結果インターフェース
 */
export interface GeocodingResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
}

/**
 * 住所から緯度経度情報を取得
 * @param address 住所文字列
 * @returns 緯度経度情報とフォーマット済み住所
 */
export const geocodeAddress = async (address: string): Promise<GeocodingResult | null> => {
  try {
    // 環境変数から設定を読み込み
    const apiKey = config.geocoding?.apiKey || process.env.GEOCODING_API_KEY || '';
    const apiUrl = process.env.GEOCODING_API_URL || 'https://maps.googleapis.com/maps/api/geocode/json';
    
    if (!apiKey || !apiUrl) {
      logger.warn('Geocoding API key or URL not configured');
      return null;
    }
    
    // 住所をエンコード
    const encodedAddress = encodeURIComponent(address);
    
    // Google Maps Geocoding APIにリクエスト
    const response = await axios.get<GeocodingResponse>(
      `${apiUrl}?address=${encodedAddress}&key=${apiKey}&language=ja&region=jp`
    );
    
    // 応答を確認
    if (response.data.status !== 'OK' || !response.data.results || response.data.results.length === 0) {
      logger.warn(`Geocoding failed for address: ${address}. Status: ${response.data.status}`);
      return null;
    }
    
    // 最初の結果を返す
    const result = response.data.results[0];
    return {
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
      formattedAddress: result.formatted_address
    };
  } catch (error) {
    logger.error('Error during geocoding:', error);
    return null;
  }
};